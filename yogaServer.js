import { createYoga } from 'graphql-yoga'
import { createServer } from 'http'
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

          const { sub: auth0Id, email } = decoded

          let user = await prisma.user.findUnique({
            where: { auth0Id }
          })

          if (!user) {
            console.log('User not found, creating a new user')
            user = await prisma.user.create({
              data: {
                auth0Id,
                email
              }
            })
            console.log('New user created:', user)
          } else {
            console.log('User found:', user)
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
    tags: [String!]!
    user: User!
  }

  type Query {
    users: [User!]!
    user(authID: String!): User
    dreams(where: DreamWhereInput): [Dream!]!
    allDreams: [Dream!]!
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
    deleteUser(auth0Id: String!): Boolean!
    addDream(userId: ID!, title: String!, date: String!, description: String!, image: String, isPublic: Boolean!, tags: [String!]!): Dream!
    deleteDream(dreamId: ID!): Boolean!
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

      return await prisma.dream.findMany({
        where: {
          user: { id: userId }
        },
        include: {
          user: true
        }
      })
    },
    allDreams: async (parent, args, context) => {
      return await prisma.dream.findMany({
        include: {
          user: true
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
      { userId, title, date, description, image, isPublic, tags },
      context
    ) => {
      try {
        console.log('Adding dream with data:', {
          userId,
          title,
          date,
          description,
          image,
          isPublic,
          tags
        }) // Log input data
        const newDream = await prisma.dream.create({
          data: {
            title,
            date,
            description,
            image,
            isPublic,
            tags,
            user: { connect: { auth0Id: userId } } // Connect using auth0Id
          }
        })
        return newDream
      } catch (error) {
        console.error('Error adding new dream:', error)
        throw new Error('Failed to add new dream')
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
    }
  },
  User: {
    dreams: async parent => {
      return await prisma.dream.findMany({
        where: { userId: parent.id }
      })
    }
  },
  Dream: {
    user: async parent => {
      return await prisma.user.findUnique({
        where: { id: parent.userId }
      })
    }
  }
}

const schema = makeExecutableSchema({ typeDefs, resolvers })

const yoga = createYoga({
  schema,
  context: async ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.error('Authorization header missing')
      throw new Error(
        'Authorization header missing. Please ensure you are sending the Authorization header with your request.'
      )
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      console.error('Token missing in Authorization header')
      throw new Error(
        'Token missing in Authorization header. Please ensure your Authorization header is in the format "Bearer <token>".'
      )
    }

    try {
      const user = await authenticateUser(token)
      return { request, user }
    } catch (error) {
      console.error('Error during user authentication:', error)
      throw new Error('Authentication failed')
    }
  },
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
})

const server = createServer(yoga)

const PORT = 4000
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
