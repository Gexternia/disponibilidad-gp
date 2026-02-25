# Disponibilidad GP

Panel de gestión de disponibilidad semanal para Guillermo Prado / Externia.

## Despliegue en GitHub Pages (5 minutos)

### 1. Crear repositorio en GitHub

Ve a [github.com/new](https://github.com/new) y crea un repositorio llamado `disponibilidad-gp` (público).

### 2. Subir el código

```bash
cd disponibilidad-gp
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/disponibilidad-gp.git
git push -u origin main
```

### 3. Instalar dependencias y desplegar

```bash
npm install
npm run deploy
```

Esto construye la app y la sube a la rama `gh-pages` automáticamente.

### 4. Activar GitHub Pages

- Ve a tu repositorio en GitHub → **Settings** → **Pages**
- En "Source" selecciona la rama `gh-pages` y carpeta `/ (root)`
- Guarda

En 1-2 minutos tu app estará en:

```
https://TU_USUARIO.github.io/disponibilidad-gp/
```

### Actualizar

Cada vez que hagas cambios, simplemente:

```bash
npm run deploy
```

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173/disponibilidad-gp/

## Notas

- Los datos se guardan en `localStorage` del navegador
- No hay backend ni base de datos
- Funciona offline una vez cargada
- Para usar en otro navegador/dispositivo tendrías que configurar los bloques de nuevo
