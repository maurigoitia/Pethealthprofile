# NotebookLM MCP — Guía de Uso para PESSY

## Instalación

```bash
# En Claude Code
claude mcp add notebooklm npx notebooklm-mcp@latest

# Verificar
claude mcp list
```

## Autenticación

Primera vez: decir "Log me in to NotebookLM". Se abre Chrome para login con Google.
Recomendación: usar cuenta dedicada para automatización, no la personal.

## Perfiles de herramientas

| Perfil | Tools | Uso |
|--------|-------|-----|
| minimal | 5 | Solo queries — ideal para consultas rápidas |
| standard | 10 | + Library management — recomendado para PESSY |
| full | 16 | + Cleanup y admin — para mantenimiento |

Configurar: `npx notebooklm-mcp config set profile standard`

## Operaciones principales

### Consultar un notebook
Preguntar directamente en el chat y el MCP busca en los notebooks configurados.
Las respuestas vienen con citaciones de los documentos fuente.

### Gestionar biblioteca
El MCP auto-selecciona notebooks relevantes según el contexto de la tarea.
Se pueden guardar, organizar y renombrar notebooks.

### Límites
- Free tier: 50 queries/día por cuenta
- Máximo 10 sesiones concurrentes
- Auto-cleanup después de 15 min inactividad

## Troubleshooting
- Si falla auth: cerrar Chrome → "Log me in to NotebookLM" de nuevo
- Si no encuentra notebooks: usar `re_auth` para cambiar cuenta Google
- Deep cleanup preserva la biblioteca mientras resetea el browser state
