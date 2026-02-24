---
layout: default
title: 아카이브
description: 모든 글 목록
permalink: /archive/
---
<div class="page-layout">
  <div class="container">
    <div class="page-header">
      <h1>아카이브</h1>
      <p class="page-description">총 {{ site.posts | size }}개의 글이 있습니다.</p>
    </div>

    <div class="archive-list">
      {% assign posts_by_year = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}
      {% for year_group in posts_by_year %}
      <div class="archive-year">
        <h2 class="archive-year-title">{{ year_group.name }}</h2>
        {% for post in year_group.items %}
        <a href="{{ post.url | relative_url }}" class="archive-post">
          <span class="archive-date">{{ post.date | date: "%m.%d" }}</span>
          <span class="archive-title">{{ post.title }}</span>
          {% if post.tags.size > 0 %}
          <span class="post-tag">{{ post.tags | first }}</span>
          {% endif %}
        </a>
        {% endfor %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>
