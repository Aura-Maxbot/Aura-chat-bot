"""owner code + resident phone

Revision ID: f26817dba897
Revises: b2e5aa99981d
Create Date: 2026-09-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f26817dba897'
down_revision: Union[str, Sequence[str], None] = 'b2e5aa99981d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- invite_code: убираем лишние поля ---
    op.drop_constraint('invite_code_created_by_resident_fkey', 'invite_code', type_='foreignkey')
    op.drop_constraint('invite_code_created_by_staff_fkey', 'invite_code', type_='foreignkey')
    op.drop_column('invite_code', 'type')
    op.drop_column('invite_code', 'created_by_resident')
    op.drop_column('invite_code', 'created_by_staff')
    op.drop_column('invite_code', 'target_role')

    # --- resident: unique на phone ---
    op.create_unique_constraint('uq_resident_phone', 'resident', ['phone'])

    # --- staff: unique на phone ---
    op.create_unique_constraint('uq_staff_phone', 'staff', ['phone'])


def downgrade() -> None:
    op.drop_constraint('uq_staff_phone', 'staff', type_='unique')
    op.drop_constraint('uq_resident_phone', 'resident', type_='unique')
    op.add_column('invite_code', sa.Column('target_role', sa.VARCHAR(length=50), nullable=True))
    op.add_column('invite_code', sa.Column('created_by_staff', sa.INTEGER(), nullable=True))
    op.add_column('invite_code', sa.Column('created_by_resident', sa.INTEGER(), nullable=True))
    op.add_column('invite_code', sa.Column('type', sa.VARCHAR(length=50), nullable=False))
    op.create_foreign_key('invite_code_created_by_staff_fkey', 'invite_code', 'staff', ['created_by_staff'], ['id'])
    op.create_foreign_key('invite_code_created_by_resident_fkey', 'invite_code', 'resident', ['created_by_resident'], ['id'])
    op.add_column('invite_code', sa.Column('type', sa.VARCHAR(length=50), nullable=False, server_default='owner'))