import strawberry
from strawberry.schema.config import StrawberryConfig

from resolvers.categoria import CategoriaQueries
from resolvers.producto import ProductoQueries, ProductoMutations
from resolvers.carrito import CarritoQueries, CarritoMutations
from resolvers.pedido import PedidoQueries, PedidoMutations
from resolvers.usuario import UsuarioMutations
from resolvers.estadisticas import EstadisticasQueries


@strawberry.type
class Query(CategoriaQueries, ProductoQueries, CarritoQueries, PedidoQueries, EstadisticasQueries):
    pass


@strawberry.type
class Mutation(UsuarioMutations, ProductoMutations, CarritoMutations, PedidoMutations):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation, config=StrawberryConfig(auto_camel_case=False))