create type public."MessageType" as enum ('system', 'user', 'assistant', 'tool');

alter type public."MessageType" owner to postgres;

create type public."Language" as enum ('de', 'en');

alter type public."Language" owner to postgres;

create table if not exists public.users
(
    id            uuid                     default gen_random_uuid()                                                    not null
        primary key,
    external_id   text                                                                                                  not null
        unique,
    created_at    timestamp with time zone default now()                                                                not null,
    "isAdmin"     boolean                  default false                                                                not null,
    configuration json                     default '{}'::json                                                           not null,
    shortcuts     json                     default '{   "newChat": "n",   "settings": "s",   "focusInput": " " }'::json not null
);

alter table public.users
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on public.users to anon;

grant delete, insert, references, select, trigger, truncate, update on public.users to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.users to service_role;

create table if not exists public.chats
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    user_id    uuid                     default gen_random_uuid() not null
        references public.users
            on update cascade on delete cascade,
    name       text,
    created_at timestamp with time zone default now()             not null
);

alter table public.chats
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on public.chats to anon;

grant delete, insert, references, select, trigger, truncate, update on public.chats to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.chats to service_role;

create table if not exists public.messages
(
    id           uuid                     default gen_random_uuid() not null
        primary key,
    chat_id      uuid                     default gen_random_uuid() not null
        references public.chats
            on update cascade on delete cascade,
    type         "MessageType"                                      not null,
    text         text,
    finished     boolean                  default false             not null,
    "hasAudio"   boolean                  default false             not null,
    provider     text,
    model        text,
    created_at   timestamp with time zone default now()             not null,
    "references" json                     default '[]'::json        not null,
    files        json                     default '[]'::json        not null
);

alter table public.messages
    owner to postgres;

grant delete, insert, references, select, trigger, truncate, update on public.messages to anon;

grant delete, insert, references, select, trigger, truncate, update on public.messages to authenticated;

grant delete, insert, references, select, trigger, truncate, update on public.messages to service_role;

