"""SCRUM-8: Fix JWT verification en oauth.ts — usar Admin SDK en lugar de decode manual"""

path = '/Users/mauriciogoitia/Pethealthprofile/functions/src/gmail/oauth.ts'
with open(path, 'r') as f:
    content = f.read()

# Replace insecure decodeEmailFromIdToken with secure verifyIdToken using Admin SDK
old_fn = '''function decodeEmailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
  try {
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as Record<string, unknown>;
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}'''

new_fn = '''/**
 * SCRUM-8: Verifica la firma del id_token usando Firebase Admin SDK.
 * Reemplaza la decodificación manual sin verificación de firma.
 * Un atacante podría forjar un JWT sin verificación — esto lo previene.
 */
async function verifyIdTokenAndGetEmail(idToken: string | undefined): Promise<string | null> {
  if (!idToken) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.email ?? null;
  } catch (err) {
    console.error("[oauth] id_token verification failed:", err);
    return null;
  }
}'''

if old_fn in content:
    content = content.replace(old_fn, new_fn)
    print("Function replaced ✅")
else:
    print("ERROR: Could not find decodeEmailFromIdToken function")
    exit(1)

# Replace the call site (sync → async, function name change)
old_call = 'let accountEmail = decodeEmailFromIdToken(tokenResponse.id_token);'
new_call = 'let accountEmail = await verifyIdTokenAndGetEmail(tokenResponse.id_token);'

if old_call in content:
    content = content.replace(old_call, new_call)
    print("Call site updated ✅")
else:
    print("WARNING: call site not found, may need manual update")

with open(path, 'w') as f:
    f.write(content)
print("oauth.ts updated ✅")
