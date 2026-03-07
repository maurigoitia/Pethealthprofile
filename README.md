
  # Pet Health Profile

  This is a code bundle for Pet Health Profile. The original project is available at https://www.figma.com/design/eZNmtbYWOY2sT5b9e6Gjeg/Pet-Health-Profile.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
## Firebase Push Notifications (VAPID)

Create `.env.local` (or copy from `.env.example`) and set:

`VITE_FIREBASE_VAPID_KEY=<PUBLIC_VAPID_KEY>`

Important: use only the public VAPID key on frontend. Never store the private VAPID key in this repository.
