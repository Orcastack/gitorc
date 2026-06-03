create table if not exists local_auth_accounts (
    id uuid primary key,
    username varchar(80) not null unique,
    email varchar(255) not null unique,
    display_name varchar(255) not null,
    password_hash text not null,
    role varchar(64) not null default 'platform-operator',
    status varchar(32) not null default 'pending_review',
    identity varchar(255) not null,
    created_at timestamptz not null default now()
);

create index if not exists local_auth_accounts_status_idx
    on local_auth_accounts (status, created_at desc);
