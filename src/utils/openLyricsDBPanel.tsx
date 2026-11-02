import { getSettingsReturn } from "./settings.ts";
import { PopupModal } from "../components/Modal.ts";
import LyricsDBPanel from "../components/ReactComponents/LyricsManager/index.tsx";
import UploadTTMLModal from "../components/ReactComponents/LyricsManager/components/UploadTTMLModal.tsx";
import { createReactModalContent } from "./reactModalContent.tsx";

export function OpenLyricsDBPanel(targetDocument: Document = document) {
  _openUpload(targetDocument);
}

export function OpenTTMLDatabasePanel() {
  if (PopupModal.isConnected) {
    _openDB();
    return;
  }

  PopupModal.display({
    title: "TTML Database",
    ...createReactModalContent(<LyricsDBPanel onBack={() => _openUpload()} />),
    isLarge: true,
  });
}

export async function OpenTTMLDatabasePanelFromSettings() {
  const modalDocument = PopupModal.ownerDocument;
  const openSettings = getSettingsReturn(modalDocument);

  _openDB(openSettings, "settingsTTMLDatabase");
}

function _openDB(onBack = _openUpload, modalId: string | null = null) {
  PopupModal.transition({
    title: "TTML Database",
    ...createReactModalContent(<LyricsDBPanel onBack={() => onBack()} />),
    isLarge: true,
    modalId,
  });
}

function _openUpload(targetDocument: Document = PopupModal.ownerDocument) {
  const options = {
    title: "Load TTML",
    modalId: "loadTTML",
    ...createReactModalContent(
      <UploadTTMLModal onOpenDB={() => _openDB()} onDone={() => PopupModal.hide()} />,
      targetDocument
    ),
    isLarge: true,
  };

  if (PopupModal.isConnected) {
    PopupModal.transition(options);
  } else {
    PopupModal.display({ ...options, targetDocument });
  }
}
