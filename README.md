# Marks BG Site

Next.js app for chat, image, and video generation with Firebase-backed auth, storage, and media history.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Firebase and Azure OpenAI values.

3. Run the development server:

   ```bash
   npm run dev
   ```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Firebase

Firebase hosting, Firestore rules, Firestore indexes, and Storage rules are included:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
