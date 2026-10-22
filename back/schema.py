import strawberry
from strawberry.schema.config import StrawberryConfig

from resolvers.mis_pedidos import MisPedidosSubscriptions
from resolvers.discogs import DiscogsQueries, DiscogsMutations
from resolvers.direccion import DireccionQueries
from resolvers.categoria import CategoriaQueries
from resolvers.producto import ProductoQueries, ProductoMutations
from resolvers.carrito import CarritoQueries, CarritoMutations
from resolvers.pedido import PedidoQueries, PedidoMutations
from resolvers.usuario import UsuarioMutations
from resolvers.estadisticas import EstadisticasQueries
from resolvers.pago import PagoMutations
from resolvers.admin import AdminMutations, AdminSubscriptions

@strawberry.type
class Query(CategoriaQueries, ProductoQueries, CarritoQueries, PedidoQueries, EstadisticasQueries, DireccionQueries, DiscogsQueries):
    pass


@strawberry.type
class Mutation(UsuarioMutations, ProductoMutations, CarritoMutations, PedidoMutations, PagoMutations, AdminMutations, DiscogsMutations):
    pass


@strawberry.type
class Subscription(AdminSubscriptions, MisPedidosSubscriptions):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription, config=StrawberryConfig(auto_camel_case=False))