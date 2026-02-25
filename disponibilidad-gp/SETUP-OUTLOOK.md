# 📅 Configuración de Sincronización con Outlook

## Paso 1: Registrar app en Azure AD (5 minutos, una sola vez)

1. Ve a [Azure Portal → App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
   - Si no tienes cuenta de Azure, puedes crearla gratis con cualquier cuenta de Microsoft

2. Clic en **"New registration"**

3. Rellena:
   - **Name**: `Disponibilidad GP` (o lo que quieras)
   - **Supported account types**: selecciona **"Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts"**
   - **Redirect URI**: 
     - Tipo: **Single-page application (SPA)**
     - URL: `https://gexternia.github.io/disponibilidad-gp/`

4. Clic en **"Register"**

5. En la página de la app, copia el **"Application (client) ID"** — es un GUID tipo `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## Paso 2: Configurar permisos API

1. En el menú lateral de la app registrada, ve a **"API permissions"**

2. Clic en **"Add a permission"** → **"Microsoft Graph"** → **"Delegated permissions"**

3. Busca y añade:
   - `Calendars.Read`

4. Clic en **"Add permissions"**

5. (Opcional) Si estás en un tenant de empresa, pide a tu admin que haga clic en **"Grant admin consent"**. Si es una cuenta personal, no es necesario.

## Paso 3: Configurar en la app

1. Abre la app: https://gexternia.github.io/disponibilidad-gp/

2. En la vista Admin, clic en **"📅 Calendario"**

3. Pega el **Application (client) ID** y dale a Guardar

4. Conecta cada cuenta de Microsoft con su cliente:
   - Clic en "Conectar cuenta" junto a **Externa** → inicia sesión con tu email de Externa
   - Clic en "Conectar cuenta" junto a **SOMOS** → inicia sesión con tu email de SOMOS

5. Clic en **"🔄 Sincronizar calendarios ahora"**

## Cómo funciona

- **Sincronización manual**: Clic en 🔄 Sync para traer los eventos de la semana actual
- **Auto-sincronización**: Cada vez que cambias de semana, la app sincroniza automáticamente
- **Auto-rellenar**: El botón ✨ rellena automáticamente los bloques libres con el cliente correspondiente donde tengas eventos
- **Overlay visual**: Los eventos del calendario aparecen como badges dentro de las celdas del grid

## Notas importantes

- Los tokens se guardan en localStorage del navegador (mismo navegador, misma URL)
- Si el token expira, la app pide reconectarse automáticamente con un popup
- La app SOLO lee el calendario (permiso `Calendars.Read`), no puede crear ni modificar eventos
- Los datos del calendario no se envían a ningún servidor — todo funciona en tu navegador
- Si usas el navegador en modo privado, tendrás que reconectar cada vez
