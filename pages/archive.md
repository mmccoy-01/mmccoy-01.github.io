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
  <time class="year lead d-block">2019</time>
  <ul class="list-unstyled">
    {% for post in site.posts %}
      {% assign ts = post.date | date: '%s' %}
      <li>
        <span class="date day" data-ts="{{ ts }}" data-df="DD">{{ post.date | date: '%d' }}</span>
        <span class="date month small text-muted ms-1" data-ts="{{ ts }}" data-df="MMM">
          {{ post.date | date: '%b' }}
        </span>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      </li>
    {% endfor %}
  </ul>
</div>
