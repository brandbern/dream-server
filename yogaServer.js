import { createYoga } from 'graphql-yoga'
import { createServer } from 'https'
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import dotenv from 'dotenv'
import { makeExecutableSchema } from '@graphql-tools/schema'

dotenv.config()

const prisma = new PrismaClient()

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
})

function getKey (header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      return callback(err)
    }
    const signingKey = key.getPublicKey()
    callback(null, signingKey)
  })
}

const authenticateUser = async token => {
  if (!token) {
    throw new Error('No token provided')
  }

  console.log('Authenticating token, length:', token.length)



  try {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: `https://${process.env.AUTH0_DOMAIN}/`
        },
        async (err, decoded) => {
          if (err) {
            console.error('JWT verification failed:', err)
            return reject('Authentication failed')
          }

          console.log('JWT decoded successfully:', { sub: decoded.sub, email: decoded.email })

          const { sub: auth0Id, email } = decoded

          let user = await prisma.user.findUnique({
            where: { auth0Id }
          })

          if (!user) {
            // Check if a user with this email already exists
            const existingUserByEmail = await prisma.user.findUnique({
              where: { email }
            })

            if (existingUserByEmail) {
              // Update the existing user's auth0Id to match the current login
              console.log('User with email exists, updating auth0Id')
              user = await prisma.user.update({
                where: { email },
                data: { auth0Id }
              })
              console.log('User auth0Id updated:', user.id)
            } else {
              // Create a new user
              console.log('User not found, creating a new user')
              user = await prisma.user.create({
                data: {
                  auth0Id,
                  email
                }
              })
              console.log('New user created:', user.id)
            }
          } else {
            console.log('User found:', user.id)
          }

          resolve(user)
        }
      )
    })
  } catch (error) {
    console.error('Error during authentication:', error)
    throw new Error('Authentication failed')
  }
}

const typeDefs = `
  type User {
    id: ID!
    auth0Id: String!
    email: String!
    firstName: String
    lastName: String
    picture: String
    createdAt: String!
    dreams: [Dream!]!
  }

  type Dream {
    id: ID!
    title: String!
    date: String!
    description: String!
    image: String
    isPublic: Boolean!
    tags: [String]
    user: User!
    mood: String
    emotions: [String]
    colors: [String]
    role: Boolean
    people: [String]
    places: [String]
    things: [String]
    isFavorited: Boolean
  }

  type Favorite {
    id: ID!
    userId: String!
    dreamId: String!
    createdAt: String!
    user: User!
    dream: Dream!
    note: Note
  }

  type Note {
    id: ID!
    favoriteId: String!
    content: String!
    createdAt: String!
    updatedAt: String!
    favorite: Favorite!
  }

  type Query {
    users: [User!]!
    user(authID: String!): User
    dreams(where: DreamWhereInput): [Dream!]!
    allDreams: [Dream!]!
    userFavorites: [Favorite!]!
    userNotes: [Note!]!
    note(favoriteId: ID!): Note
  }

  input DreamWhereInput {
    user: UserWhereInput
  }

  input UserWhereInput {
    id: String
  }

  type Mutation {
    authenticateUser: User
    addUser(auth0Id: String!, email: String!, name: String): User!
    updateUser(
      firstName: String,
      lastName: String,
      picture: String
    ): User!
    deleteUser(auth0Id: String!): Boolean!
    addDream(
      title: String!,
      date: String!,
      description: String!,
      image: String,
      isPublic: Boolean!,
      tags: [String],
      mood: String,
      emotions: [String],
      colors: [String],
      role: Boolean,
      people: [String],
      places: [String],
      things: [String]
    ): Dream!
    deleteDream(dreamId: ID!): Boolean!
    updateDream(
      id: ID!,
      title: String!,
      description: String!,
      mood: String,
      emotions: [String],
      colors: [String],
      role: Boolean,
      people: [String],
      places: [String],
      things: [String]
    ): Dream!
    toggleFavorite(dreamId: ID!): Boolean!
    saveNote(favoriteId: ID!, content: String!): Note!
  }
`

const resolvers = {
  Query: {
    users: async () => {
      return await prisma.user.findMany({
        include: { dreams: true }
      })
    },
    user: async (parent, { authID }, context) => {
      return await prisma.user.findUnique({
        where: { auth0Id: authID }
      })
    },
    dreams: async (parent, args, context) => {
      const userId = context.user.id

      const dreams = await prisma.dream.findMany({
        where: {
          user: { id: userId }
        },
        include: {
          user: true
        }
      })
      
      // Add isFavorited field for each dream
      const userFavorites = await prisma.favorite.findMany({
        where: { userId },
        select: { dreamId: true }
      })
      const favoritedDreamIds = new Set(userFavorites.map(f => f.dreamId))
      
      return dreams.map(dream => ({
        ...dream,
        isFavorited: favoritedDreamIds.has(dream.id)
      }))
    },
    allDreams: async (parent, args, context) => {
      const dreams = await prisma.dream.findMany({
        include: {
          user: true
        }
      })
      
      // Add isFavorited field for each dream (only if user is authenticated)
      if (context.user) {
        const userId = context.user.id
        const userFavorites = await prisma.favorite.findMany({
          where: { userId },
          select: { dreamId: true }
        })
        const favoritedDreamIds = new Set(userFavorites.map(f => f.dreamId))
        
        return dreams.map(dream => ({
          ...dream,
          isFavorited: favoritedDreamIds.has(dream.id)
        }))
      } else {
        // For non-authenticated users, return dreams without favorite status
        return dreams.map(dream => ({
          ...dream,
          isFavorited: false
        }))
      }
    },
    userFavorites: async (parent, args, context) => {
      const userId = context.user.id
      return await prisma.favorite.findMany({
        where: { userId },
        include: {
          user: true,
          dream: {
            include: {
              user: true
            }
          }
        }
      })
    },
    userNotes: async (parent, args, context) => {
      const userId = context.user.id
      // Find all notes for favorites belonging to this user
      const favorites = await prisma.favorite.findMany({
        where: { userId },
        select: { id: true }
      })
      const favoriteIds = favorites.map(f => f.id)
      return await prisma.note.findMany({
        where: { favoriteId: { in: favoriteIds } },
        include: {
          favorite: {
            include: {
              user: true,
              dream: { include: { user: true } }
            }
          }
        }
      })
    },
    note: async (parent, { favoriteId }, context) => {
      // Only allow access if the favorite belongs to the user
      const userId = context.user.id
      const favorite = await prisma.favorite.findUnique({ where: { id: favoriteId } })
      if (!favorite || favorite.userId !== userId) return null
      return await prisma.note.findUnique({
        where: { favoriteId },
        include: {
          favorite: {
            include: {
              user: true,
              dream: { include: { user: true } }
            }
          }
        }
      })
    }
  },
  Mutation: {
    addUser: async (parent, { auth0Id, email, name }, context) => {
      try {
        const newUser = await prisma.user.create({
          data: {
            auth0Id,
            email,
            name
          }
        })
        return newUser
      } catch (error) {
        console.error('Error adding new user:', error)
        throw new Error('Failed to add new user')
      }
    },
    updateUser: async (parent, { firstName, lastName, picture }, context) => {
      try {
        const userId = context.user.id
        
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            firstName,
            lastName,
            picture
          }
        })
        
        console.log(`User with id ${userId} updated successfully.`)
        return updatedUser
      } catch (error) {
        console.error('Error updating user:', error)
        throw new Error(`Failed to update user: ${error.message}`)
      }
    },
    deleteUser: async (parent, { auth0Id }, context) => {
      try {
        const user = await prisma.user.findUnique({
          where: { auth0Id }
        })

        if (!user) {
          throw new Error('User not found')
        }

        await prisma.user.delete({
          where: { auth0Id }
        })

        console.log(`User with auth0Id ${auth0Id} deleted successfully.`)
        return true
      } catch (error) {
        console.error('Error deleting user:', error)
        return false
      }
    },
    addDream: async (
      parent,
      {
        title,
        date,
        description,
        image,
        isPublic,
        tags,
        mood,
        emotions,
        colors,
        role,
        people,
        places,
        things
      },
      context
    ) => {
      try {
        // Use the authenticated user's ID from context
        const userId = context.user.id
        
        const newDream = await prisma.dream.create({
          data: {
            title,
            date,
            description,
            image,
            isPublic,
            tags,
            user: { connect: { id: userId } },
            mood,
            emotions,
            colors,
            role,
            people,
            places,
            things
          },
          include: {
            user: true
          }
        })
        return newDream
      } catch (error) {
        console.error('Error adding new dream:', error)
        throw new Error(`Failed to add new dream: ${error.message}`)
      }
    },
    deleteDream: async (parent, { dreamId }, context) => {
      try {
        const dream = await prisma.dream.findUnique({
          where: { id: dreamId }
        })

        if (!dream) {
          throw new Error('Dream not found')
        }

        await prisma.dream.delete({
          where: { id: dreamId }
        })

        console.log(`Dream with id ${dreamId} deleted successfully.`)
        return true
      } catch (error) {
        console.error('Error deleting dream:', error)
        return false
      }
    },
    updateDream: async (
      parent,
      {
        id,
        title,
        description,
        mood,
        emotions,
        colors,
        role,
        people,
        places,
        things
      },
      context
    ) => {
      try {
        // Check if the dream exists and belongs to the authenticated user
        const existingDream = await prisma.dream.findUnique({
          where: { id },
          include: { user: true }
        })

        if (!existingDream) {
          throw new Error('Dream not found')
        }

        if (existingDream.user.id !== context.user.id) {
          throw new Error('Unauthorized: You can only update your own dreams')
        }

        const updatedDream = await prisma.dream.update({
          where: { id },
          data: {
            title,
            description,
            mood,
            emotions,
            colors,
            role,
            people,
            places,
            things
          },
          include: {
            user: true
          }
        })

        console.log(`Dream with id ${id} updated successfully.`)
        return updatedDream
      } catch (error) {
        console.error('Error updating dream:', error)
        throw new Error(`Failed to update dream: ${error.message}`)
      }
    },
    toggleFavorite: async (parent, { dreamId }, context) => {
      try {
        const userId = context.user.id
        
        // Check if the dream exists
        const dream = await prisma.dream.findUnique({
          where: { id: dreamId }
        })
        
        if (!dream) {
          throw new Error('Dream not found')
        }
        
        // Check if already favorited
        const existingFavorite = await prisma.favorite.findUnique({
          where: {
            userId_dreamId: {
              userId,
              dreamId
            }
          }
        })
        
        if (existingFavorite) {
          // Remove favorite
          await prisma.favorite.delete({
            where: {
              userId_dreamId: {
                userId,
                dreamId
              }
            }
          })
          console.log(`Favorite removed for dream ${dreamId} by user ${userId}`)
          return false
        } else {
          // Add favorite
          await prisma.favorite.create({
            data: {
              userId,
              dreamId
            }
          })
          console.log(`Favorite added for dream ${dreamId} by user ${userId}`)
          return true
        }
      } catch (error) {
        console.error('Error toggling favorite:', error)
        throw new Error(`Failed to toggle favorite: ${error.message}`)
      }
    },
    saveNote: async (parent, { favoriteId, content }, context) => {
      try {
        const userId = context.user.id
        // Only allow if the favorite belongs to the user
        const favorite = await prisma.favorite.findUnique({ where: { id: favoriteId } })
        if (!favorite || favorite.userId !== userId) {
          throw new Error('Unauthorized or favorite not found')
        }
        // Upsert note by favoriteId
        const note = await prisma.note.upsert({
          where: { favoriteId },
          update: { content },
          create: { favoriteId, content },
          include: {
            favorite: {
              include: {
                user: true,
                dream: { include: { user: true } }
              }
            }
          }
        })
        console.log(`Note saved for favorite ${favoriteId} by user ${userId}`)
        return note
      } catch (error) {
        console.error('Error saving note:', error)
        throw new Error(`Failed to save note: ${error.message}`)
      }
    }
  },
  User: {
    createdAt: (parent) => {
      // Convert DateTime to ISO string for GraphQL
      return parent.createdAt.toISOString()
    },
    dreams: async parent => {
      return await prisma.dream.findMany({
        where: { userId: parent.id }
      })
    }
  },
  Dream: {
    date: (parent) => {
      // Convert DateTime to ISO string for GraphQL
      if (!parent.date) {
        return null
      }
      
      try {
        return parent.date.toISOString()
      } catch (error) {
        return null
      }
    },
    user: async parent => {
      return await prisma.user.findUnique({
        where: { id: parent.userId }
      })
    },
    isFavorited: async (parent, args, context) => {
      if (!context?.user?.id) return false
      
      const favorite = await prisma.favorite.findUnique({
        where: {
          userId_dreamId: {
            userId: context.user.id,
            dreamId: parent.id
          }
        }
      })
      
      return !!favorite
    }
  },
  Favorite: {
    createdAt: (parent) => {
      return parent.createdAt.toISOString()
    },
    user: async parent => {
      return await prisma.user.findUnique({
        where: { id: parent.userId }
      })
    },
    dream: async parent => {
      return await prisma.dream.findUnique({
        where: { id: parent.dreamId },
        include: {
          user: true
        }
      })
    },
    note: async parent => {
      return await prisma.note.findUnique({
        where: { favoriteId: parent.id },
        include: {
          favorite: {
            include: {
              user: true,
              dream: { include: { user: true } }
            }
          }
        }
      })
    }
  },
  Note: {
    createdAt: (parent) => {
      return parent.createdAt.toISOString()
    },
    updatedAt: (parent) => {
      return parent.updatedAt.toISOString()
    },
    favorite: async parent => {
      return await prisma.favorite.findUnique({
        where: { id: parent.favoriteId },
        include: {
          user: true,
          dream: { include: { user: true } }
        }
      })
    }
  }
}

const schema = makeExecutableSchema({ typeDefs, resolvers })

const yoga = createYoga({
  schema,
  context: async ({ request }) => {
    const authHeader = request.headers.get('authorization')
    
    // Allow requests without authentication for public queries
    if (!authHeader) {
      return { request, user: null }
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return { request, user: null }
    }

    try {
      const user = await authenticateUser(token)
      return { request, user }
    } catch (error) {
      console.error('Error during user authentication:', error)
      return { request, user: null }
    }
  },
  cors: {
    origin: ['https://localhost:3000', 'https://192.168.0.65:3000'],
    credentials: true,
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
})

// HTTPS configuration
const httpsOptions = {
  key: readFileSync('../dream-speak/localhost-key.pem'),
  cert: readFileSync('../dream-speak/localhost.pem')
}

const server = createServer(httpsOptions, yoga)

const PORT = 4000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on https://localhost:${PORT}`)
  console.log(`Server is also accessible on https://192.168.0.65:${PORT}`)
})
