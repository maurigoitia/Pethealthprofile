function r(e){return e?e.replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1").replace(/#{1,6}\s+/g,"").replace(/`{1,3}[^`]*`{1,3}/g,"").replace(/^[-*+]\s+/gm,"").replace(/^\d+\.\s+/gm,"").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/\n{3,}/g,`

`).replace(/\n/g," ").replace(/\s{2,}/g," ").trim():""}export{r as c};
