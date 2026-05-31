create table if not exists signup_requests (
    id uuid primary key,
    username varchar(80) not null,
    email varchar(255) not null,
    status varchar(32) not null default 'pending_review',
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by varchar(255),
    review_note text not null default ''
);

create index if not exists signup_requests_status_created_at_idx
    on signup_requests (status, created_at desc);

create unique index if not exists signup_requests_pending_email_idx
    on signup_requests (email)
    where status = 'pending_review';
