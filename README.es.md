# Calma

Un Spotify más tranquilo: colores de la portada, reproductor flotante con cristal y movimiento discreto.

[Descargar la última versión](https://github.com/ell1zv4/calma-spicetify/releases/latest) · [English](README.md)

![Vista de álbum de Calma](previews/album.png)

## Instalación

En **Marketplace → Themes**, busca **Calma** e instálalo. Reinicia Spotify después de instalarlo o actualizarlo. Su aparición en la búsqueda depende de la indexación de GitHub.

También puedes descargar `Calma-v1.0.0.zip` desde [Releases](https://github.com/ell1zv4/calma-spicetify/releases/latest), extraer la carpeta `Calma` en la carpeta `Themes` de Spicetify y ejecutar:

```sh
spicetify config current_theme Calma color_scheme Calma inject_theme_js 1
spicetify apply
```

La carpeta de temas suele estar en `%appdata%\spicetify\Themes\` en Windows y en `~/.config/spicetify/Themes/` en Linux y macOS. Mantén juntos `user.css`, `theme.js` y `color.ini`.

## Detalles

- Inicio con hasta nueve discos y playlists personales, luz del color de la portada y animación de ida y vuelta.
- Encabezados con color propio y un degradado que continúa hacia las canciones.
- Canciones compactas, entrada escalonada al abrir y una respuesta breve al empezar la reproducción.
- Reproductor flotante, biblioteca transparente y menús nativos.
- Inicio adaptable, foco de teclado visible y movimiento reducido según el dispositivo.

## Ajustes

Haz **clic derecho en el botón de biblioteca del reproductor**. Con el botón enfocado por teclado, en Windows también puedes usar **Mayús+F10**.

Puedes elegir el movimiento, activar vistas previas, recuperar los controles de vista y orden, y fijar la playlist que tengas abierta. Las vistas previas están desactivadas por defecto y solo pueden sonar con la música en pausa. Los ajustes y la playlist fijada permanecen en tu ordenador.

La integración con [ivLyrics](https://github.com/ivLis-Studio/ivLyrics) es opcional. Si está instalado, la rueda del ratón abre sus letras a pantalla completa. Calma no instala esa aplicación, no crea tiempos de karaoke ni necesita claves de IA.

## Compatibilidad

Probado en **Windows, Spotify 1.3.9.2055 y Spicetify 2.46.7**. macOS y Linux no se han comprobado en equipos nativos para esta versión. Los cambios de interfaz de Spotify pueden exigir una actualización del tema.

Una cuenta nueva puede tener menos de nueve recomendaciones disponibles. La carga de playlists grandes sigue dependiendo de Spotify; la animación de portada no retrasa la navegación.

Para quitar el tema:

```sh
spicetify config current_theme "" color_scheme ""
spicetify apply
```

Código con [licencia MIT](LICENSE), sin analítica ni datos personales incluidos. [Historial de cambios](CHANGELOG.md).
