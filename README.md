# Dream Server

## Overview

Dream Server is the backend service for the DreamSpeak web application. It is built with Node.js, GraphQL Yoga, and Prisma, and it uses a PostgreSQL database for data management. The server handles user authentication via Auth0 and provides a GraphQL API for managing user dreams.

## Features

- User authentication with Auth0
- Manage personal dreams
- View all public dreams
- GraphQL API with GraphQL Yoga
- Prisma ORM for database management

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/your-username/dream-server.git
   cd dream-server
   ```

2. Install the dependencies:

   ```sh
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following variables:

   ```env
   AUTH0_DOMAIN=dev-wrmepf3pb43nrndk.us.auth0.com
   DATABASE_URL=your-database-url
   ```

   **Auth0 Dashboard**: https://dev-wrmepf3pb43nrndk.us.auth0.com

4. Apply Prisma migrations to set up the database schema:

   ```sh
   npx prisma migrate deploy
   ```

5. Start the server:

   ```sh
   npm start
   ```

## Project Structure

- **Main entry point**: `yogaServer.js` (startLine: 1, endLine: 304)
- **Prisma schema**: `prisma/schema.prisma` (startLine: 1, endLine: 31)
- **Migrations**: `prisma/migrations`
- **Scripts**: `scripts/`

## Scripts

- **Start**: `npm start`
- **Migrate**: `npx prisma migrate deploy`
- **Create Test User**: `node scripts/createTestUser.js`
- **Delete All Dreams**: `node scripts/deleteAllDreams.js`

## Test User

For development and testing purposes, you can use the pre-populated test user:

**Test User Details:**

- **Email**: `testuser@dreamspeak.com`
- **Auth0 ID**: `auth0|test-user-dreams`
- **Total Dreams**: 15
- **Public Dreams**: 11
- **Private Dreams**: 4

**Dream Categories:**

- **58 unique tags** covering various themes (flying, city, futuristic, freedom, library, books, mystery, portal, ocean, underwater, etc.)
- **6 different moods** (Exciting, Curious, Wonder, Confusing, Peaceful, Scary)
- **Rich emotional content** with 20+ different emotions
- **Varied content types**: Some dreams have images, others don't; mix of public and private dreams

To populate the test user data, run:

```sh
node scripts/createTestUser.js
```

## GraphQL API

The backend uses GraphQL Yoga to provide a GraphQL API. The schema and resolvers are defined in `yogaServer.js` (startLine: 76, endLine: 260).

## Authentication

Authentication is handled using Auth0. The authentication logic is implemented in `yogaServer.js` (startLine: 27, endLine: 73).

## License

This project is licensed under the MIT License.
