import { getSettingsReturn } from "./settings.ts";
import { PopupModal } from "../components/Modal.ts";
import LyricsSourcesManager from "../components/ReactComponents/SettingsPanel/LyricsSourcesManager.tsx";
import { createReactModalContent } from "./reactModalContent.tsx";

export async function OpenLyricsSourcesManager() {
  const modalDocument = PopupModal.ownerDocument;
  const openSettings = getSettingsReturn(modalDocument);

  const backButton = modalDocument.createElement("button");
  backButton.className = "sl-sp-btn sl-modal-header-back-btn";
  backButton.type = "button";
  backButton.textContent = "← Back";
  backButton.onclick = openSettings;

  const options = {
    title: "Manage Sources",
    ...createReactModalContent(<LyricsSourcesManager />, modalDocument),
    isLarge: true,
    modalId: "lyricsSourcesManager",
    headerLeft: backButton,
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display(options);
  }
}
