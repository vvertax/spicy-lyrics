type DiagnosticEntry={time:string;scope:string;message:string;stack?:string};
const errors:DiagnosticEntry[]=[];
export function redactDiagnostic(text:string):string {
  return text.replace(/(["']?(?:token|authorization|cookie|secret|password|api[_-]?key)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,'$1[redacted]').replace(/spotify:(?:track|user|playlist|local):[^\s"']+/gi,'spotify:[redacted]').replace(/Bearer\s+[^\s,;]+/gi,'Bearer [redacted]').replace(/(token|authorization|cookie|secret|password|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,'$1=[redacted]').replace(/https?:\/\/[^\s"'<>]+/gi,url=>url.split(/[?#]/)[0]).replace(/[A-Z]:\\[^\n]+/gi,'[local path]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email]').replace(/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g,'[token]').slice(0,1200);
}
export function recordDiagnostic(scope:string,args:unknown[]){
  const message=args.map(value=>value instanceof Error?`${value.name}: ${value.message}`:typeof value==='string'?value:typeof value==='number'?String(value):'[details omitted]').join(' ');
  const error=args.find(value=>value instanceof Error) as Error|undefined;
  const stack=error?.stack ? redactDiagnostic(error.stack.split("\n").slice(0,7).join("\n")) : undefined;
  errors.push({time:new Date().toISOString(),scope:redactDiagnostic(scope),message:redactDiagnostic(message),...(stack?{stack}:{})});if(errors.length>30)errors.shift();
}
export function diagnosticErrors(){return errors.map(e=>({...e}));}
