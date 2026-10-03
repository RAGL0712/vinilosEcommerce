# Islas (componentes React hidratados)

Cada archivo de esta carpeta es una isla: se monta en una pagina con una directiva `client:*`.

| Isla | Pagina | Directiva |
|---|---|---|
| Nav.jsx | Layout (todas las paginas privadas) | client:load |
| Hero.jsx | index | client:idle |
| Catalogo.jsx | index | client:load |
| Categoria.jsx | categoria | client:load |
| Producto.jsx | producto | client:load |
| Carrito.jsx | carrito | client:load |
| Checkout.jsx | checkout | client:load |
| AuthForm.jsx | login, registro | client:load |

`components/Tarjetas.jsx` NO es una isla: es un componente auxiliar que usan Catalogo y Categoria.
Todo lo que no esta aqui (info-bar, footer, encabezados) es HTML estatico de Astro.
