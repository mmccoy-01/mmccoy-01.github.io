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

  .timeline {
    position: relative;
    margin: 40px 0;
    padding: 20px 0;
    list-style: none;
  }

  .timeline:before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #3498db;
    left: 50%;
    margin-left: -2px;
  }

  .timeline-item {
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 20px;
    position: relative;
  }

  .timeline-item:before,
  .timeline-item:after {
    content: '';
    display: table;
  }

  .timeline-item:after {
    clear: both;
  }

  .timeline-item:before,
  .timeline-item:after {
    content: '';
    display: table;
  }

  .timeline-item:after {
    clear: both;
  }

  .timeline-item .timeline-point {
    position: absolute;
    border-radius: 50%;
    background: #3498db;
    width: 20px;
    height: 20px;
    left: 50%;
    margin-left: -10px;
    z-index: 1000;
  }

  .timeline-item .timeline-content {
    margin-left: 30px;
    background: #ecf0f1;
    padding: 10px;
    border-radius: 4px;
  }
</style>

<div class="timeline">
  {% assign last_year = "" %}
  {% for post in site.posts %}
    {% assign cur_year = post.date | date: '%Y' %}
    {% if cur_year != last_year %}
      {% if forloop.index > 1 %}
        </div>
      {% endif %}
      <div class="timeline-item">
        <div class="timeline-point"></div>
        <div class="timeline-content">
          <h3>{{ cur_year }}</h3>
        </div>
      </div>
    {% endif %}
    <div class="timeline-item">
      <div class="timeline-point"></div>
      <div class="timeline-content">
        <h4>{{ post.title }}</h4>
        <p>{{ post.excerpt }}</p>
        <a href="{{ post.url | relative_url }}">Read more</a>
      </div>
    </div>
    {% assign last_year = cur_year %}
  {% endfor %}
</div>
