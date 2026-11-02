import { getSettingsReturn } from "./settings.ts";
import { PopupModal } from "../components/Modal.ts";
import ExperimentsPanel from "../components/ReactComponents/SettingsPanel/ExperimentsPanel.tsx";
import { createReactModalContent } from "./reactModalContent.tsx";

export async function OpenAdvancedExperiments() {
  const modalDocument = PopupModal.ownerDocument;
  const openSettings = getSettingsReturn(modalDocument);

  const backButton = modalDocument.createElement("button");
  backButton.className = "sl-sp-btn sl-modal-header-back-btn";
  backButton.type = "button";
  backButton.textContent = "← Back";
  backButton.onclick = openSettings;

  const options = {
    title: "Experiments",
    ...createReactModalContent(<ExperimentsPanel advancedOnly showBuiltIn={false} />, modalDocument),
    isLarge: true,
    modalId: "advancedExperiments",
    headerLeft: backButton,
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display(options);
  }
}
