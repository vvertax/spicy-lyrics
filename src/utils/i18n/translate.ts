import ru from "./ru.json";
export type Language = "en" | "ru";
const dictionary: Record<string,string> = ru;
export function translateUi(text: string, language: Language): string {
  if(language!=="ru")return text;
  if(dictionary[text])return dictionary[text];
  const core=text.trim();
  if(dictionary[core])return text.replace(core,dictionary[core]);
  if(core.startsWith("Code: "))return `Код: ${core.slice(6)}`;
  const available=core.match(/^Version (.+) is out$/);
  if(available)return `Доступна версия ${available[1]}`;
  const updateToast=core.match(/^Spicy Lyrics (.+) is out$/);
  if(updateToast)return `Доступна Spicy Lyrics ${updateToast[1]}`;
  const current=core.match(/^You're on (.+)$/);
  if(current)return `Установлена версия ${current[1]}`;
  const staying=core.match(/^Staying on (.+)$/);
  if(staying)return `Сохранена версия ${staying[1]}`;
  const differences=core.match(/^(\d+) differing lines · text \/ timing$/);
  if(differences)return `${differences[1]} строк с различиями · текст / тайминг`;
  const shortcut=core.split(" · ");
  if(shortcut.length>1&&dictionary[shortcut[0]])return text.replace(shortcut[0],dictionary[shortcut[0]]);
  const lines=core.match(/^(\d+) \/ 12 lines$/);if(lines)return `${lines[1]} / 12 строк`;
  const version=core.match(/^(Updated to|Changed to|Loaded|Showing) (.+)$/);
  if(version)return `${({"Updated to":"Обновлено до","Changed to":"Версия изменена на","Loaded":"Загружено","Showing":"Показано"} as Record<string,string>)[version[1]]} ${version[2]}`;
  const side=core.match(/^(Add note to|Choose a TTML file for side|Load version|Lyrics) ([AB])$/);
  if(side)return `${({"Add note to":"Замечание к","Choose a TTML file for side":"Выберите TTML для стороны","Load version":"Загрузить версию","Lyrics":"Текст"} as Record<string,string>)[side[1]]} ${side[2]}`;
  return text;
}
