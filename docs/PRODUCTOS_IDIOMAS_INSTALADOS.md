# Idiomas instalados e inactivos de PrestaShop

PrestaShop1.7.8.11 usa Language::getIDs(), cuyo argumento active es true por defecto. Un idioma instalado puede figurar en /api/languages pero quedar omitido en las lecturas y escrituras de productos que no indiquen language.

El transporte de alta y su comprobación usan language=[ID|ID] con todos los IDs del perfil. Las ediciones y las descripciones de finalización envían explícitamente los idiomas seleccionados, sin activar idiomas en la configuración de la tienda.

Si un producto ya se creó con una traducción omitida: NO crear otro ni cambiar el diario. Leer y corregir la traducción en el ID existente mediante prestashop_product_prepare/commit y su idioma explícito. Después conciliar la solicitud de alta original con su mismo UUID y contenido esperado. Solo continuar sus etapas cuando el GET completo acredite los campos y se cierre la solicitud.

El puente de ChatGPT conserva ahora el diagnóstico acotado del servicio para indicar el campo que falla, en lugar de reducirlo siempre a HTTP400 genérico.

Referencias oficiales:
- https://devdocs.prestashop-project.org/1.7/webservice/cheat-sheet/
- https://github.com/PrestaShop/PrestaShop/blob/1.7.8.11/classes/Language.php
- https://github.com/PrestaShop/PrestaShop/blob/1.7.8.11/classes/webservice/WebserviceRequest.php

Prueba nativa: el entorno desechable instala un idioma inactivo adicional, crea textos distintos en ambos idiomas y verifica sus relecturas explícitas. Este archivo no declara por sí mismo una publicación ni una reparación real.
