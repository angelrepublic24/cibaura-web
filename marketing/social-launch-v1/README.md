# Kit provisional de lanzamiento

Abrir **[index.html](index.html)** con doble clic: galería local de las nueve piezas, con enlaces a los archivos y al guion. No necesita servidor ni conexión.

## Qué publicar ahora

Cuatro conceptos, cada uno en feed y en historias. Usar los **JPG** para publicar; los PNG son los originales de generación. Son ilustraciones editoriales de pre-lanzamiento, no fotografías de inventario. Cibaura es la marca provisional del proyecto; sustituirla cuando se decida la definitiva.

| Concepto | Feed | Historias | Uso |
|---|---|---|---|
| Pre-lanzamiento | [01-launch.jpg](feed/01-launch.jpg) | [01-launch.jpg](stories/01-launch.jpg) | Presentar la propuesta y pedir que sigan el lanzamiento. |
| Cómo funciona | [02-how-it-works.jpg](feed/02-how-it-works.jpg) | [02-how-it-works.jpg](stories/02-how-it-works.jpg) | Encontrar, solicitar, firmar y recoger; la aceptación del host se indica. |
| Diferenciales | [03-why-it-matters.jpg](feed/03-why-it-matters.jpg) | [03-why-it-matters.jpg](stories/03-why-it-matters.jpg) | Agencias verificadas, opciones de entrega en aeropuerto y firma previa. Entrega sujeta a host/cobertura. |
| Propietarios particulares | [04-become-a-host.jpg](feed/04-become-a-host.jpg) | [04-become-a-host.jpg](stories/04-become-a-host.jpg) | Alquilar el carro propio, sin prometer ocupación ni ingresos. |

Los cuatro anuncios llevan **Coming soon**. No hay precios, métricas, fecha de apertura, URL inventada, vehículos supuestamente disponibles ni aeropuerto identificable. El anuncio de lanzamiento se plantea como expectativa porque hoy no hay inventario real; no dice “Book now”. No quitar las condiciones al recortar o añadir stickers.

[COPY.md](COPY.md) contiene pies de publicación en inglés, CTA y texto alternativo. No se ha publicado ni enviado nada a redes.

## Formatos entregados

- Feed: 1254 × 1254 px, cuadrado 1:1.
- Historias: 940/941 × 1672 px, aproximadamente 9:16. El generador entregó ese redondeo; no se declaran como 1080 × 1920 ni se ampliaron artificialmente.
- Miniatura: 1672 × 941 px, aproximadamente 16:9. [JPG para subir](youtube/thumbnail.jpg), 292.864 bytes; [PNG original](youtube/thumbnail.png).
- JPG entre 183.159 y 292.864 bytes. `assets.json` registra los PNG; `delivery-assets.json`, los JPG.

Se revisaron visualmente las nueve composiciones, textos y ausencia de inventario fingido. Se corrigió la colocación del aviso de la historia “Cómo funciona”. La previsualización final de la plataforma sigue siendo necesaria para colocar sus overlays sin tapar textos. No se ha realizado una prueba de publicación en cuentas reales.

La miniatura es ilustrada deliberadamente: no inventa la cara del dueño, una recogida ni una captura del producto. Está preparada para el vídeo futuro, **no para anunciar que ese viaje ya ocurrió**. El JPG queda por debajo del límite móvil de 2 MB indicado por [YouTube](https://support.google.com/youtube/answer/72431?hl=en), consultado el 28-09-2026.

## Vídeo auténtico, pendiente de rodaje

[VIDEO.md](VIDEO.md): guion de unos 90 segundos, texto hablado, rótulos, planos con un teléfono y puntos de inserción de las capturas de Claude. No se ha generado ni grabado un vídeo. No se han recibido archivos de esas capturas: los códigos S1–S5 son una lista de montaje, no nombres de vídeos existentes.

## Criterio de idioma

Entrego inglés para corresponder al sitio que hay hoy. **Mi recomendación editorial para RD es español para público local y captación de propietarios**, e inglés para campañas dirigidas a viajeros anglófonos. Es criterio de comunicación, no un resultado medido de campañas. No mezclar ambas audiencias en una sola imagen llena de traducciones. Cuando el destino web en español esté listo, adaptar este mismo set al español; hasta entonces, un post en español debería advertir claramente que la web está en inglés. El dueño puede narrar el vídeo en español si esa es su voz natural; la versión entregada aquí mantiene los textos públicos en inglés conforme al encargo.

## Origen, edición y aislamiento

Generación y ajustes visuales realizados con la herramienta integrada **image_gen**, sin CLI de generación ni clave API. [prompts.json](prompts.json) conserva todos los prompts y la revisión del margen. Los originales seleccionados se copiaron desde el directorio de generación de Codex a esta carpeta. Los JPG son recodificaciones de entrega (Sharp, calidad 90, mozjpeg): sin composición, retoque, recorte ni cambio de dimensiones. Los PNG permanecen intactos. El kit no añade scripts ejecutables al proyecto.

La carpeta `frontend/marketing/` está fuera de `src/` y de `public/`, sin imports desde la aplicación. La regla `/marketing/` añadida a `.dockerignore` la excluye incluso del contexto enviado al build Docker. El runtime sigue copiando únicamente standalone, static, public y el healthcheck; ningún fichero de este kit se conecta al bundle. No se cambiaron componentes, dependencias ni rutas.

No se ejecutaron gates de código por este entregable de marketing. Se verificaron archivos, dimensiones, peso de JPG, enlaces locales de la galería y la regla de exclusión. No se construyó una imagen Docker ni se arrancó su daemon. Sin commit, push ni PR para esta entrega.
