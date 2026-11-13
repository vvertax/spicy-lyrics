export const IsPIP = new URL(location.href).searchParams.get("layout")==="popup";
export const _IsPIP_after = false;
export const IsPIPOpening = false;
export const OpenPopupLyrics = async()=>{window.dispatchEvent(new CustomEvent('preview:notice',{detail:'Open the popup layout preview in a separate browser window.'}));};
export const ClosePopupLyrics = async()=>{};
