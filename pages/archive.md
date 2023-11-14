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

<style>
  body {
    font-family: 'Lato', sans-serif;
    margin: 0;
  }

  #archives {
    margin: 40px 0;
  }

  .year {
    font-size: 24px;
    margin-bottom: 10px;
    color: #3498db;
  }

  .archive-list {
    list-style: none;
    padding: 0;
  }

  .archive-item {
    margin-bottom: 20px;
    position: relative;
  }

  .archive-year {
    font-size: 18px;
    font-weight: bold;
  }

  .archive-point {
    position: absolute;
    border-radius: 50%;
    background: #3498db;
    width: 20px;
    height: 20px;
    left: -10px;
    top: 0;
    margin-left: 50%;
    z-index: 1000;
  }

  .archive-content {
    margin-left: 30px;
    background: #ecf0f1;
    padding: 10px;
    border-radius: 4px;
  }
</style>

<div id="archives">
  {% assign last_year = "" %}
  {% for post in site.posts %}
    {% assign cur_year = post.date | date: '%Y' %}
    {% if cur_year != last_year %}
      {% if forloop.index > 1 %}
        </ul>
      {% endif %}
      <div class="year">{{ cur_year }}</div>
      <ul class="archive-list">
      {% assign last_year = cur_year %}
    {% endif %}
    <li class="archive-item">
      <div class="archive-year">{{ cur_year }}</div>
      <div class="archive-point"></div>
      <div class="archive-content">
        <span class="date day" data-ts="{{ post.date | date: '%s' }}" data-df="DD">{{ post.date | date: '%d' }}</span>
        <span class="date month small text-muted ms-1" data-ts="{{ post.date | date: '%s' }}" data-df="{{ df_dayjs_m }}">
          {{ post.date | date: '%b' }}
        </span>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      </div>
    </li>
    {% if forloop.last %}
      </ul>
    {% endif %}
  {% endfor %}
</div>
