-- ==========================================
-- 0. LIMPIAR (para poder ejecutar el archivo completo otra vez)
-- ==========================================
DROP TABLE IF EXISTS detalle_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS items_carrito CASCADE;
DROP TABLE IF EXISTS carritos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TYPE IF EXISTS status_pedido_enum;
DROP TYPE IF EXISTS rol_usuario_enum;

-- ==========================================
-- 1. CREACIÓN DE TIPOS ENUM
-- ==========================================
CREATE TYPE status_pedido_enum AS ENUM ('PENDIENTE', 'PAGADO', 'ENVIADO', 'CANCELADO');
CREATE TYPE rol_usuario_enum AS ENUM ('CLIENTE', 'ADMIN');

-- ==========================================
-- 2. CREACIÓN DE TABLAS
-- ==========================================

CREATE TABLE usuarios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(100) DEFAULT NULL,
  email varchar(150) UNIQUE DEFAULT NULL,
  password varchar(255) DEFAULT NULL,
  rol rol_usuario_enum NOT NULL DEFAULT 'CLIENTE'
);

CREATE TABLE categorias (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(100) NOT NULL
);

CREATE TABLE productos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo varchar(150) DEFAULT NULL,
  artista varchar(150) DEFAULT NULL,
  precio numeric(10,2) DEFAULT NULL,
  imagen_url varchar(255) DEFAULT NULL,
  stock integer NOT NULL DEFAULT 0,
  categoria_id integer NOT NULL,
  CONSTRAINT productos_ibfk_1 FOREIGN KEY (categoria_id) REFERENCES categorias (id)
);

CREATE TABLE carritos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL UNIQUE,
  CONSTRAINT carritos_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE items_carrito (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  carrito_id integer NOT NULL,
  producto_id integer NOT NULL,
  cantidad integer NOT NULL,
  CONSTRAINT unique_carrito_producto UNIQUE (carrito_id, producto_id),
  CONSTRAINT items_carrito_ibfk_1 FOREIGN KEY (carrito_id) REFERENCES carritos (id) ON DELETE CASCADE,
  CONSTRAINT items_carrito_ibfk_2 FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE
);

CREATE TABLE refresh_tokens (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL,
  jti varchar(100) NOT NULL UNIQUE,
  usado boolean NOT NULL DEFAULT FALSE,
  CONSTRAINT refresh_tokens_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE pedidos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL,
  nombre_cliente varchar(150) NOT NULL,
  email varchar(150) NOT NULL,
  direccion varchar(255) NOT NULL,
  total numeric(10,2) NOT NULL,
  fecha timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status status_pedido_enum NOT NULL DEFAULT 'PENDIENTE',
  CONSTRAINT pedidos_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
);

CREATE TABLE detalle_pedido (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id integer NOT NULL,
  producto_id integer NOT NULL,
  cantidad integer NOT NULL,
  precio_unitario numeric(10,2) NOT NULL,
  CONSTRAINT detalle_pedido_ibfk_1 FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE CASCADE,
  CONSTRAINT detalle_pedido_ibfk_2 FOREIGN KEY (producto_id) REFERENCES productos (id)
);

-- ==========================================
-- 3. INSERCIÓN DE DATOS
-- ==========================================

-- Usuarios (la contraseña real se pone con: python crear_usuarios.py)
INSERT INTO usuarios (id, nombre, email, password, rol) OVERRIDING SYSTEM VALUE VALUES
(1, 'cliente1', '1@gmail', 'temporal', 'CLIENTE'),
(2, 'admin', 'admin@gmail', 'temporal', 'ADMIN');

INSERT INTO categorias (id, nombre) OVERRIDING SYSTEM VALUE VALUES 
(1, 'OST'), (2, 'JAZZ'), (3, 'OTRO'), (4, 'ELECTRONICA'), (5, 'ROCK'), (6, 'POP'), (7, 'BGM');

INSERT INTO productos (id, titulo, artista, precio, imagen_url, stock, categoria_id) OVERRIDING SYSTEM VALUE VALUES
(1, 'Minecraft Volume beta', 'C418', 500.00, 'https://mediacdn.aent-m.com/prod-img/500/16/3811816-2576215.jpg', 25, 1),
(2, 'Minecraft volume alpha', 'C418', 520.00, 'https://upload.wikimedia.org/wikipedia/en/5/5f/Minecraft_%E2%80%93_Volume_Alpha.jpeg?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=original', 25, 1),
(3, 'Vinilo mockup', 'Mockup', 690.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8x94dMMY3BwCd_5t8H_L9X5hH-vtLai696ZUk7z-1eAfRH0eB-tk17yk&s=10', 15, 2),
(4, 'Vynil', 'Artista 1', 350.00, 'https://mockups-design.com/wp-content/uploads/2022/07/Free_Vinyl_Mockup_3.jpg', 15, 3),
(5, 'Disco 1', 'Artista 3', 500.00, 'https://img.magnific.com/vector-premium/cubierta-disco-vinilo-lp-record-disco-vinilo-dentro_148087-16.jpg?semt=ais_hybrid&w=740&q=80', 15, 4),
(6, 'Disco 3', 'Artista 1', 360.00, 'https://cdn.creativefabrica.com/2021/06/25/VINYL-RECORD-MOCKUP-COLLECTION-1-Graphics-13848359-1.jpg', 15, 2),
(7, 'Vynil 3', 'Artista 4', 350.00, 'https://img.magnific.com/psd-premium/maqueta-set-vinilos_1304338-1600.jpg?semt=ais_hybrid&w=740&q=80', 15, 5),
(8, 'Vynil 7', 'Artista 7', 390.00, 'https://unblast.com/wp-content/uploads/2018/06/Vinyl-Record-MockUp-Colored.jpg', 15, 6),
(9, 'Disco 20', 'Artista 2', 540.00, 'https://mir-s3-cdn-cf.behance.net/projects/808/ed23f5171783417.Y3JvcCwzODM1LDMwMDAsMzMyLDA.jpg', 15, 7);

INSERT INTO pedidos (id, usuario_id, nombre_cliente, email, direccion, total, fecha, status) OVERRIDING SYSTEM VALUE VALUES
(1, 1, '1', '1@gmail', '1', 850.00, '2026-08-01 10:00:00', 'PAGADO'),
(2, 1, 'USER 1', 'email@gmai.com', 'A', 2670.00, '2026-08-05 12:30:00', 'PAGADO'),
(3, 1, '1', '123@gmail.com', '1', 710.00, '2026-08-10 09:15:00', 'ENVIADO'),
(4, 1, 'User 1', 'user1@gmail.com', 'AV. 444 ', 1870.00, '2026-08-20 18:45:00', 'PENDIENTE');

INSERT INTO detalle_pedido (id, pedido_id, producto_id, cantidad, precio_unitario) OVERRIDING SYSTEM VALUE VALUES
(1, 1, 1, 1, 500.00),
(2, 1, 4, 1, 350.00),
(3, 2, 3, 1, 690.00),
(4, 2, 9, 1, 540.00),
(5, 2, 2, 1, 520.00),
(6, 2, 8, 1, 390.00),
(7, 2, 6, 1, 360.00),
(8, 3, 7, 1, 350.00),
(9, 3, 6, 1, 360.00),
(10, 4, 5, 2, 500.00),
(11, 4, 4, 1, 350.00),
(12, 4, 2, 1, 520.00);

-- ==========================================
-- 4. AJUSTE DE CONTADORES AUTOINCREMENTABLES
-- ==========================================
SELECT setval(pg_get_serial_sequence('usuarios', 'id'), coalesce(max(id), 1)) FROM usuarios;
SELECT setval(pg_get_serial_sequence('categorias', 'id'), coalesce(max(id), 1)) FROM categorias;
SELECT setval(pg_get_serial_sequence('productos', 'id'), coalesce(max(id), 1)) FROM productos;
SELECT setval(pg_get_serial_sequence('pedidos', 'id'), coalesce(max(id), 1)) FROM pedidos;
SELECT setval(pg_get_serial_sequence('detalle_pedido', 'id'), coalesce(max(id), 1)) FROM detalle_pedido;



