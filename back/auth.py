def requerir_usuario(info):
    usuario = info.context["usuario"]
    if usuario is None:
        if info.context["expirado"]:
            raise Exception("TOKEN_EXPIRADO")
        raise Exception("Debes iniciar sesion")
    return usuario


def requerir_admin(info):
    usuario = requerir_usuario(info)
    if usuario["rol"] != "ADMIN":
        raise Exception("No tienes permiso")
    return usuario
