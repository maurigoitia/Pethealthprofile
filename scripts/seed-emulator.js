#!/usr/bin/env node
/**
 * seed-emulator.js
 * Seeds Firebase Local Emulators with 1 user + 1 pet + visible data for smoke tests.
 *
 * Usage:
 *   node scripts/seed-emulator.js           # seed
 *   node scripts/seed-emulator.js --reset   # wipe + re-seed
 *
 * Requires emulators running: firebase emulators:start --only auth,firestore,functions
 *
 * Test credentials:
 *   Email:    test@pessy.app
 *   Password: Test1234!
 */

import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";

// ── Config ──────────────────────────────────────────────────────────────────
const EMULATOR_HOST = "127.0.0.1";
const AUTH_PORT = 9099;
const FIRESTORE_PORT = 8080;

const TEST_USER = {
  email: "test@pessy.app",
  password: "Test1234!",
  displayName: "Mauri Test",
};

const TEST_PET = {
  id: "pet-fixture-001",
  name: "Luna",
  species: "dog",
  breed: "Labrador Retriever",
  gender: "female",
  birthDate: "2022-03-15",
  weight: 22,
  weightUnit: "kg",
  color: "amarillo",
  photoURL: null,
  isActive: true,
  createdAt: new Date().toISOString(),
};

// ── Init ─────────────────────────────────────────────────────────────────────
// Must match VITE_FIREBASE_PROJECT_ID so the emulator namespace aligns with the web app
const app = initializeApp({
  apiKey: "fake-api-key-for-emulator",
  authDomain: "localhost",
  projectId: "polar-scene-488615-i0",
});

const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_PORT}`, { disableWarnings: true });
connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_PORT);

// ── Helpers ──────────────────────────────────────────────────────────────────
async function clearCollection(collectionPath) {
  const snap = await getDocs(collection(db, collectionPath));
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
  console.log(`  cleared ${collectionPath} (${snap.size} docs)`);
}

async function getOrCreateUser() {
  try {
    const cred = await signInWithEmailAndPassword(auth, TEST_USER.email, TEST_USER.password);
    console.log("  ✓ user exists, signed in:", cred.user.uid);
    return cred.user;
  } catch {
    const cred = await createUserWithEmailAndPassword(auth, TEST_USER.email, TEST_USER.password);
    console.log("  ✓ user created:", cred.user.uid);
    return cred.user;
  }
}

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  const reset = process.argv.includes("--reset");
  console.log(`\n🌱 Pessy Emulator Seed${reset ? " (--reset)" : ""}\n`);

  if (reset) {
    console.log("Wiping test data...");
    await clearCollection("users");
    await clearCollection("pets");
    await clearCollection("push_tokens");
    await clearCollection("pending_reviews");
  }

  // 1. User
  console.log("Creating user...");
  const user = await getOrCreateUser();

  // 2. User profile in Firestore
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: TEST_USER.email,
    displayName: TEST_USER.displayName,
    activePetId: TEST_PET.id,
    onboardingComplete: true,
    createdAt: new Date().toISOString(),
  }, { merge: true });
  console.log("  ✓ users/" + user.uid);

  // 3. Pet
  const petRef = doc(db, "pets", TEST_PET.id);
  await setDoc(petRef, { ...TEST_PET, ownerId: user.uid }, { merge: true });
  console.log("  ✓ pets/" + TEST_PET.id);

  // 4. One upcoming appointment (visible in Home QuickActionsV2 counter)
  const apptId = "appt-fixture-001";
  await setDoc(doc(db, "appointments", apptId), {
    id: apptId,
    petId: TEST_PET.id,
    ownerId: user.uid,
    title: "Control anual",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    type: "checkup",
    vetName: "Dr. García",
    status: "scheduled",
    createdAt: new Date().toISOString(),
  }, { merge: true });
  console.log("  ✓ appointments/" + apptId);

  // 5. One active medication (visible in Home counter)
  const medId = "med-fixture-001";
  await setDoc(doc(db, "medications", medId), {
    id: medId,
    petId: TEST_PET.id,
    ownerId: user.uid,
    name: "Antiparasitario mensual",
    dose: "1 comprimido",
    frequency: "monthly",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  }, { merge: true });
  console.log("  ✓ medications/" + medId);

  console.log("\n✅ Seed complete!\n");
  console.log("  Login:    test@pessy.app / Test1234!");
  console.log("  Pet:      Luna (Labrador, female, 2022)");
  console.log("  Appt:     Control anual en 7 días");
  console.log("  Med:      Antiparasitario mensual (activo)");
  console.log("\n  Firebase UI: http://localhost:4000");
  console.log("  App:         http://localhost:5173/inicio\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
