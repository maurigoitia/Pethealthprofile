let cached: string | null = null;

export async function loadPessyLogo(path = "/pessy-logo.png"): Promise<string> {
  if (cached) return cached;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load Pessy logo (${res.status})`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      cached = reader.result as string;
      resolve(cached);
    };
    reader.onerror = () => reject(new Error("FileReader failed reading logo"));
    reader.readAsDataURL(blob);
  });
}

export function __resetLogoCacheForTests() {
  cached = null;
}
