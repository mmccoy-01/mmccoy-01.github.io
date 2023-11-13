---
layout: page
menu: false
date: '2023-11-13 18:19:37'
title: Archive
description: This page is an archive of posts.
permalink: /archive/
---

<img class="img-rounded" src="/assets/img/icons/largetile.png" alt="Katalepsara" width="200">

{% assign df_strftime_m = site.data.locales[lang].df.archives.strftime | default: '/ %m' %}
{% assign df_dayjs_m = site.data.locales[lang].df.archives.dayjs | default: '/ MM' %}

<div id="archives" class="pl-xl-3">
  {% assign last_year = nil %}
  
  {% for post in site.posts %}
    {% assign cur_year = post.date | date: '%Y' %}

    {% if cur_year != last_year %}
      {% unless forloop.first %}</ul>{% endunless %}

      <time class="year lead d-block">{{ cur_year }}</time>
      {{ '<ul class="list-unstyled">' }}

      {% assign last_year = cur_year %}
    {% endif %}

    <li>
      {% assign ts = post.date | date: '%s' %}
      <span class="date day" data-ts="{{ ts }}" data-df="DD">{{ post.date | date: '%d' }}</span>
      <span class="date month small text-muted ms-1" data-ts="{{ ts }}" data-df="{{ df_dayjs_m }}">
        {{ post.date | date: df_strftime_m }}
      </span>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </li>

    {% if forloop.last %}</ul>{% endif %}
  {% endfor %}
</div>
