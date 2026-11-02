import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "./InfoTip";
import { playSfx } from "@/lib/audio";
import { SFX } from "@/lib/sfx";

// One consistent way back to the main menu: DoorOpen icon, "Main Menu" label
// (or an icon-only variant for tight headers) and the same sound effect.
export function MainMenuButton({
  onClick,
  compact = false,
  className = "",
  variant = "outline",
}) {
  const go = () => {
    playSfx(SFX.mainMenu, { gain: 0.75 });
    onClick?.();
  };

  if (compact) {
    return (
      <InfoTip label="Return to the main menu">
        <Button
          size="icon"
          variant={variant}
          className={`h-8 w-8 ${className}`}
          title="Main Menu"
          aria-label="Main Menu"
          onClick={go}
        >
          <DoorOpen className="h-4 w-4" />
        </Button>
      </InfoTip>
    );
  }

  return (
    <InfoTip label="Return to the main menu">
      <Button size="sm" variant={variant} className={className} onClick={go}>
        <DoorOpen className="mr-1 h-4 w-4" /> Main Menu
      </Button>
    </InfoTip>
  );
}
