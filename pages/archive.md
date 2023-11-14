---
layout: page
menu: false
date: '2023-11-13 18:19:37'
title: Archive
description: This page is an archive of posts.
permalink: /archive/
---

<img class="img-rounded" src="/assets/img/icons/largetile.png" alt="Katalepsara" width="200">

<style>
  body {
    font-family: 'Lato', sans-serif;
    margin: 0;
  }

  #archives {
    margin: 40px 0;
    padding-left: 30px; /* Adjusted to provide space for the year */
  }

.year {
  font-size: 24px;
  margin-bottom: 10px;
  color: #b0ad92;
  text-align: center; /* Center the text */
}

  .archive-list {
    list-style: none;
    padding: 0;
  }

  .archive-item {
    margin-bottom: 40px; /* Increased margin for more space */
    position: relative;
  }

  .archive-year {
    font-size: 18px;
    font-weight: bold;
  }

  .archive-point {
    position: absolute;
    border-radius: 50%;
    background: #b0ad92;
    width: 20px;
    height: 20px;
    left: -10px;
    top: 0;
    margin-left: 50%;
    z-index: 1000;
  }

.archive-content {
  position: relative;
  padding: 30px; /* Increased padding for more space */
  border-radius: 4px;
  background-size: cover;
  background-position: center center;
  color: #fff; /* Adjusted text color for better readability on images */
  text-decoration: none; /* Remove default link underline */
  display: block;
  height: 100%; /* Ensures the link takes up the full height of its parent */
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
}

.archive-content h3 {
   margin: 0;
}

.tags {
    font-size: 14px;
    color: #888;
    margin-top: 10px;
  }

  .tag-link {
    margin-right: 10px;
    text-decoration: none;
    color: #333;
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
      {% if forloop.first %}
        <div class="year">{{ cur_year }}</div>
      {% endif %}
      <ul class="archive-list">
      {% assign last_year = cur_year %}
    {% endif %}
    <li class="archive-item">
      <div class="archive-point"></div>
      <a href="{{ post.url | relative_url }}" class="archive-content" style="background-image: url('{{ post.image }}');">
        <span class="date day" data-ts="{{ post.date | date: '%s' }}" data-df="DD">{{ post.date | date: '%d' }}</span>
        <span class="date month small text-muted ms-1" data-ts="{{ post.date | date: '%s' }}" data-df="{{ df_dayjs_m }}">
          {{ post.date | date: '%b' }}
        </span>
        <h3>{{ post.title }}</h3>
      </a>
      <div class="tags">
        Tags:
        {% for tag in post.tags %}
          <a href="/tags/#{{ tag | slugify }}" class="tag-link">{{ tag }}</a>
        {% endfor %}
      </div>
    </li>
    {% if forloop.last %}
      </ul>
    {% endif %}
  {% endfor %}
</div>
