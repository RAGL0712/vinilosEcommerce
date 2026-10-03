export default function Tarjetas({ productos }) {
  return (
    <div className="grid-productos">
      {productos.map((d) => (
        <a key={d.id} className="previewProduct" href={`/producto?id=${d.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src={d.imagen_url} alt={d.titulo} className="previewImage" />
          <h3>{d.titulo}</h3>
          <p>{d.artista}</p>
          <span>${d.precio}</span>
        </a>
      ))}
    </div>
  )
}
