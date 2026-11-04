from enum import StrEnum

from sqlalchemy import Enum


def enum_texto(enum: type[StrEnum], nome: str) -> Enum:
    # Guarda o valor como texto + CHECK, em vez de um ENUM nativo do Postgres,
    # que é difícil de alterar em migrações.
    return Enum(
        enum,
        name=nome,
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda membros: [m.value for m in membros],
    )
