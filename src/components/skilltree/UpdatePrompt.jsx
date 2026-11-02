import { useEffect, useRef, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { isTutorialOpen, subscribeTutorialOpen } from "@/lib/tutorialState";
import {
  applyServiceWorkerUpdate,
  checkForUpdates,
  dismissUpdate,
  isNativeApp,
  openUpdateDownload,
  registerServiceWorker,
  useAppUpdates,
} from "@/lib/appUpdates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { toast } from "sonner";

// Startup update consent. Web/PWA waits for a service worker and asks before
// activating it; the native APK asks before opening the new APK download.
export function UpdatePrompt() {
  const { settings } = useTree();
  const updates = useAppUpdates();
  const checkedUrl = useRef("");
  const [tutorialOpen, setTutorialOpenState] = useState(isTutorialOpen);

  useEffect(() => {
    // Sync on subscribe too: the tour may have opened before this component's
    // effects ran, since it lives inside the workspace subtree.
    setTutorialOpenState(isTutorialOpen());
    return subscribeTutorialOpen(() => setTutorialOpenState(isTutorialOpen()));
  }, []);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Native builds can only check a published update host; the user sets it once
  // in Settings → General. Web builds are covered by the service worker.
  useEffect(() => {
    if (!isNativeApp()) return;
    const url = String(settings?.updateUrl || "").trim();
    if (!url || url === checkedUrl.current) return;
    checkedUrl.current = url;
    checkForUpdates({ baseUrl: url }).then((result) => {
      if (result.status === "available") {
        toast("A newer APK is available.");
      }
    });
  }, [settings?.updateUrl]);

  useEffect(() => {
    const onCheck = async () => {
      const result = await checkForUpdates({
        baseUrl: String(settings?.updateUrl || "").trim(),
      });
      if (result.status === "current") toast.success("You're up to date.");
      else if (result.status === "unconfigured") {
        toast("Set an update URL in Settings → General first.");
      } else if (result.status === "error") {
        toast.error("Could not check for updates.");
      }
    };
    window.addEventListener("skilltree:check-updates", onCheck);
    return () => window.removeEventListener("skilltree:check-updates", onCheck);
  }, [settings?.updateUrl]);

  const apkUpdate = updates.update?.kind === "apk" ? updates.update : null;
  const serviceWorkerUpdate = !!updates.waiting && !updates.hidden;
  // A modal update dialog under the tutorial disables tutorial clicks. Wait
  // until the tour is closed, then show the pending update.
  const open = (!!apkUpdate || serviceWorkerUpdate) && !tutorialOpen;
  if (!open) return null;

  const close = () => dismissUpdate();

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update available</DialogTitle>
          <DialogDescription>
            {apkUpdate
              ? "A newer Android build is available. Download it now and install it over this app; your local project data stays on the device. If the download opens a browser you did not intend, use Copy link and paste it into Chrome."
              : "A new version has been downloaded. Apply it now? The app will reload once."}
          </DialogDescription>
        </DialogHeader>
        {apkUpdate?.remote?.builtAt ? (
          <p className="text-[10px] text-muted-foreground">
            Build: {new Date(apkUpdate.remote.builtAt).toLocaleString()}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Later
          </Button>
          {apkUpdate ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  copyText(apkUpdate.apkUrl).then((ok) =>
                    ok
                      ? toast.success("Update link copied.")
                      : toast.error("Could not copy the link.")
                  );
                }}
              >
                Copy link
              </Button>
              <Button
                onClick={() => {
                  openUpdateDownload(apkUpdate.apkUrl);
                  close();
                }}
              >
                Download update
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                applyServiceWorkerUpdate();
                close();
              }}
            >
              Update now
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
