# Bolteos Perks

[Abre el mazo en GitHub Pages](https://bolteos.github.io/Twitch-predis/bolteos-perks/).

El panel, los 324 iconos, el catálogo en español, los diseños de las cartas, la fuente y los audios están incluidos en esta carpeta.

## Repartir en OBS sin instalar nada

Abre el panel, elige tus ajustes y copia el enlace a una fuente Navegador. Al cargar o actualizar esa fuente se reparten cuatro cartas. En OBS → Ajustes → Atajos puedes asignar una combinación a la actualización de la fuente y usarla también desde Stream Deck. Si cambias los ajustes, vuelve a copiar el enlace.

## Conector opcional para controlar el reparto desde el panel

1. Descarga [Bolteos_Perks_Directo.zip](./Bolteos_Perks_Directo.zip) en el PC del stream y extrae todos los archivos en una carpeta.
2. Con Python 3 instalado, abre **Iniciar directo.bat**. El conector escucha en el equipo local y abre el panel con la sala asignada.
3. Si el navegador solicita acceso a la red local, permítelo. En el panel aparecerá «Directo conectado».
4. Copia el enlace de OBS a una fuente Navegador. Copia el enlace de Stream Deck a una acción de solicitud HTTP GET. Ambos programas deben estar en el mismo PC que el conector.
5. Cierra la ventana del conector al terminar. La configuración se guarda junto al script en `sala.json`. Conserva ese archivo en tu PC para reutilizar los enlaces en el próximo directo.

## Conservar una copia

En el repositorio, abre **Code → Download ZIP** para descargar los archivos. El historial de Git guarda las versiones publicadas. Para probar el mazo de una copia descargada, abre una terminal en la carpeta que contiene este documento, ejecuta `python -m http.server 8000 --bind 127.0.0.1` y visita `http://localhost:8000/`. El modo directo está configurado para el origen y la ruta de GitHub Pages indicados arriba. Si cambias de dominio o repositorio, actualiza `ORIGIN` y `PAGE` en el conector y vuelve a empaquetar el ZIP.
