# Organización, proyecto y dos repositorios GitHub

Los repositorios todavía no existen, según Ignacio. Esta entrega prepara los archivos; no crea una organización ni publica código bajo una cuenta inventada.

## Crear la estructura

1. En GitHub, crear la organización del grupo con el nombre que acuerden. Invitar a los integrantes reales y asignar roles.
2. Dentro de la organización, crear **viruta-match-api** y **viruta-match-ui**. Recomendación de la propuesta: privados. Crearlos vacíos (sin README automático) para subir las carpetas de esta entrega sin conflictos.
3. En la organización, crear un Project “Viruta Match” y agregar issues de ambos repositorios. Campos sugeridos: Responsable, Dev A/B/C, RF/CP, Estado, Prioridad, Entrega. Estados: Pendiente, En desarrollo, En revisión, Testing, Terminado.
4. Subir cada carpeta al repositorio correspondiente, con las tres ramas. No subir la carpeta que contiene ambos repos como un tercer monorepo.

## Primer push API

Reemplazar `NOMBRE-ORGANIZACION` con el nombre real. Ejecutar dentro de **viruta-match-api**:

```bash
git init -b desarrollo
git add .
git commit -m "feat: base API y modulos del dev B"
git branch testing
git branch main
git remote add origin https://github.com/NOMBRE-ORGANIZACION/viruta-match-api.git
git push -u origin desarrollo
git push origin testing main
```

## Primer push UI

Dentro de **viruta-match-ui**, ejecutar:

```bash
git init -b desarrollo
git add .
git commit -m "feat: base UI y pantallas del dev B"
git branch testing
git branch main
git remote add origin https://github.com/NOMBRE-ORGANIZACION/viruta-match-ui.git
git push -u origin desarrollo
git push origin testing main
```

Git usa la identidad que cada integrante tenga configurada. Si no está configurada, establecer el nombre y email propios antes del commit. GitHub pedirá autenticar el push. Estos comandos no despliegan a producción; solo crean los repos con sus ramas iniciales. No declarar esta base como versión productiva completa antes de integrar A/C y UAT.

## Flujo para los tres desarrolladores

En cada repo que modifique:

```bash
git switch desarrollo
git pull origin desarrollo
git switch -c feature/dev-a-carga-calidad
# modificar y verificar con npm run check
git add .
git commit -m "feat(carga): implementar alta de retazos"
git push -u origin feature/dev-a-carga-calidad
```

Abrir PR de feature hacia desarrollo. Para C usar feature/dev-c-reservas-pagos; para B feature/dev-b-<cambio>. Revisión cruzada A→B, B→C, C→A y revisión final de Román. Cuando la integración esté lista, PR desarrollo→testing. Tras pruebas y UAT, PR testing→main.

| Rama | Función | Entorno / datos |
|---|---|---|
| desarrollo | Integrar funciones de los tres | Cada PC, datos ficticios; no requiere otra instancia contratada. |
| testing | Validar versión conjunta | Sandbox/testing aislado, base testing.db. |
| main | Código autorizado para producción | Producción, base produccion.db; despliegue manual/tag. |

Se usan minúsculas como nombres técnicos exactos de las ramas. Hay una secuencia de promoción por repo. Cuando API/UI cambien conjuntamente un contrato, vincular ambos PR y probar versiones compatibles.

## Protecciones y CI

Después del primer push, configurar desarrollo como rama predeterminada de trabajo. Si el plan de GitHub lo permite, en Settings → Rules / Branches requerir PR, una revisión, check CI/validar correcto, conversaciones resueltas y prohibición de force push/eliminación sobre desarrollo/testing/main. El Líder Técnico controla promoción a main. Completar CODEOWNERS.example con usuarios reales antes de renombrarlo a CODEOWNERS.

La disponibilidad de protección de ramas privadas depende del plan; GitHub Free ofrece protecciones en públicos, y privados necesitan un plan compatible. Si el plan no permite automatizarlas, aplicar la política de revisión y promoción con responsables explícitos sin afirmar que está protegida técnicamente.

El workflow CI de API corre lint/tests. El de UI corre lint/tests/build. Ninguno despliega sin configurar los secretos, servidores y revisión de Román.

Fuentes oficiales consultadas:
- https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository
