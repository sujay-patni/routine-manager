import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCookieName, verifyCookie } from "@/lib/auth";
import { isDeviceAllowed } from "@/lib/db/devices";

export default async function BlockedPage() {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get("device_id")?.value;
  const authCookie = cookieStore.get(getCookieName())?.value;

  if (verifyCookie(authCookie)) {
    redirect("/today");
  }

  if (deviceId && await isDeviceAllowed(deviceId)) {
    redirect("/unlock");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold">Device not recognized</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This device is not on the access list.
          </p>
        </div>

        {deviceId && (
          <div className="space-y-3 text-left">
            <p className="text-sm text-muted-foreground">Your device ID:</p>
            <code className="block w-full break-all rounded-md border bg-muted px-3 py-2 text-xs font-mono">
              {deviceId}
            </code>
            <p className="text-xs text-muted-foreground">
              Add this ID to the <strong>allowed_devices</strong> table with <strong>is_active</strong>{" "}
              enabled, then refresh this page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
