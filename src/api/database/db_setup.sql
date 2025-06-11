create type public."MessageType" as enum ('system', 'user', 'assistant', 'tool');

alter type public."MessageType" owner to postgres;

create type public."Language" as enum ('de', 'en');

alter type public."Language" owner to postgres;

create table if not exists public.users
(
    id                    uuid                     default gen_random_uuid()                                                    not null
    primary key,
    externalId           text                                                                                                  not null
    unique,
    created_at            timestamp with time zone default now()                                                                not null,
    "isAdmin"             boolean                  default false                                                                not null,
    configuration         json                     default '{}'::json                                                           not null,
    shortcuts             json                     default '{   "newChat": "n",   "settings": "s",   "focusInput": " " }'::json not null,
    branched_from_chat_id uuid
    );

alter table public.users
    owner to postgres;

create table if not exists public.chats
(
    id                    uuid                     default gen_random_uuid() not null
    primary key,
    user_id               uuid                     default gen_random_uuid() not null
    references public.users
    on update cascade on delete cascade,
    name                  text,
    created_at            timestamp with time zone default now()             not null,
    branched_from_chat_id uuid,
    updated_at            timestamp                default now()             not null
    );

alter table public.chats
    owner to postgres;

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
