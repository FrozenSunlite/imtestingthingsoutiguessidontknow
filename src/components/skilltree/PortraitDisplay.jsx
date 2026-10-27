import { useEffect, useState } from "react";
import { useTree } from "@/lib/treeStore";
import { signUri } from "./TokenForge";
import { Label } from "@/components/ui/label";

// Shows the character's portrait in the Values tab. The portrait itself is
// managed in the Token Forge; this is a plain display of the current image.
export function PortraitDisplay() {
  const { character } = useTree();
  const uri = character.portraitUri || "";
  const [signed, setSigned] = useState("");

  useEffect(() => {
    let live = true;
    if (/^(https?:|data:)/.test(uri)) {
      setSigned(uri);
    } else {
      setSigned("");
      signUri(uri).then((u) => live && setSigned(u));
    }
    return () => {
      live = false;
    };
  }, [uri]);

  return (
    <div>
      <Label>Portrait</Label>
      {signed ? (
        <img
          src={signed}
          alt={character.name ? `${character.name}'s portrait` : "Character portrait"}
          className="mt-1 max-h-56 w-full rounded-md border object-contain"
        />
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          No portrait yet — upload one in the Token Forge below.
        </p>
      )}
    </div>
  );
}