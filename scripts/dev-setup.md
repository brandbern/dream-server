# Development Setup Guide

## Using the Test User

To test the application with pre-populated data, you'll need to configure Auth0 to allow the test user to authenticate.

### Option 1: Auth0 Dashboard Configuration

1. Go to your Auth0 Dashboard
2. Navigate to **Users** → **Create User**
3. Create a user with these details:

   - **Email**: `testuser@dreamspeak.com`
   - **Password**: Choose a secure password
   - **Connection**: Database (or your preferred connection)

4. After creating the user, copy the **User ID** (it should look like `auth0|xxxxxxxxxxxxxxxx`)
5. Update the `createTestUser.js` script with the correct Auth0 ID:
   ```javascript
   const testUser = {
     auth0Id: "auth0|xxxxxxxxxxxxxxxx", // Replace with actual ID
     email: "testuser@dreamspeak.com",
     // ... rest of the data
   };
   ```

### Option 2: Use Existing Auth0 ID

If you want to use the current test user ID (`auth0|test-user-dreams`), you can:

1. Create a user in Auth0 with the email `testuser@dreamspeak.com`
2. Manually update the user's Auth0 ID in the Auth0 dashboard to `auth0|test-user-dreams`

### Option 3: Development Mode (Simplest)

For local development, you can temporarily modify the authentication logic to bypass Auth0:

1. In `yogaServer.js`, modify the `authenticateUser` function to return the test user:

   ```javascript
   const authenticateUser = async (token) => {
     // For development, return test user
     if (token === "dev-token") {
       return await prisma.user.findUnique({
         where: { auth0Id: "auth0|test-user-dreams" },
       });
     }
     // ... rest of authentication logic
   };
   ```

2. In your frontend, modify the Auth0 configuration to use a development token.

## Test Data Overview

The test user has **15 diverse dreams** showcasing all features:

### Dream Types:

- **Adventure Dreams**: Flying over cities, space exploration, underwater adventures
- **Fantasy Dreams**: Dragons, magical forests, enchanted libraries
- **Sci-Fi Dreams**: Giant robots, time travel, futuristic cities
- **Peaceful Dreams**: Zen gardens, meditation, musical performances
- **Nightmares**: Being chased, dark mazes
- **Meta Dreams**: Dream within a dream scenarios

### Feature Coverage:

- ✅ **Images**: Some dreams have Unsplash images, others don't
- ✅ **Privacy**: Mix of public (11) and private (4) dreams
- ✅ **Moods**: All 6 mood types covered
- ✅ **Emotions**: 20+ different emotions represented
- ✅ **Tags**: 58 unique tags across various themes
- ✅ **Colors**: Rich color descriptions
- ✅ **People/Places/Things**: Varied content in all fields
- ✅ **Dates**: Dreams spread across 3 months (Jan-Mar 2024)

### Sample Dream Titles:

1. Flying Over the City
2. The Mysterious Library
3. Ocean Depths Adventure
4. Time Travel Mishap
5. Giant Robot Battle
6. Peaceful Garden Meditation
7. Space Station Life
8. Magical Forest Encounter
9. Nightmare: Being Chased
10. Cooking Competition
11. Floating Islands
12. Dream Within a Dream
13. Musical Performance
14. Ancient Temple Discovery
15. Flying with Dragons

## Running the Application

1. Start the server:

   ```sh
   npm start
   ```

2. Start the frontend (in another terminal):

   ```sh
   cd ../dream-speak
   npm run dev
   ```

3. Log in with the test user credentials

4. Explore the rich dream data to see how the application handles:
   - Different dream types and moods
   - Public vs private content
   - Rich metadata (tags, emotions, colors)
   - Images and text-only dreams
   - Various date ranges

## Resetting Test Data

To refresh the test data, run:

```sh
node scripts/createTestUser.js
```

This will clear existing dreams and recreate all 15 test dreams.
