---
layout: about
title: about
permalink: /
subtitle: TU/e. Eindhoven. <a href="mailto:marhiar@gmail.com">marhiar@gmail.com</a>

profile:
  align: right
  image: prof_pic.jpg
  image_circular: false # crops the image to make it circular
  more_info: >
    <p>Eindhoven, the Netherlands</p>

selected_papers: true # includes a list of papers marked as "selected={true}"
social: true # includes social icons at the bottom of the page

announcements:
  enabled: false # includes a list of news items
  scrollable: true # adds a vertical scroll bar if there are more than 3 news items
  limit: 5 # leave blank to include all the news in the `_news` folder

latest_posts:
  enabled: false
  scrollable: true # adds a vertical scroll bar if there are more than 3 new posts items
  limit: 3 # leave blank to include all the blog posts
---

> "If you cannot explain something in simple terms, you don't understand it." — Richard Feynman

> "You are under no obligation to remain the same person you were a year ago, a month ago, or even a day ago. You are here to create yourself, continuously." — Richard Feynman

I was born in Costa Rica and raised in the coffee-plantation countryside. I learned to harvest coffee before I started school. I learned early what resilience and patience look like in real life. Pick the ripe ones, leave the green ones, come back tomorrow. From age five to twenty-three, I spent three months each year in the fields, 5 AM to 4 PM, no matter the weather. You show up. You do the work.

I carried that same attitude into learning. If something makes me curious, I follow it until it makes sense.

My path has not been a straight line, because curiosity does not walk in straight lines. I started in industrial design, moved into mechanical engineering, and earned a master's in biomechatronics at Delft University of Technology. Today I am a PhD candidate in the Signal Processing Systems group at Eindhoven University of Technology. The PhD is where I get to ask "why" as my actual job.

{% include figure.liquid path="assets/img/paths.jpg" class="img-fluid rounded z-depth-1" caption="Tim Urban @waitbutwhy" %}

My research focuses on real-time Bayesian agents for personalized audio processing. I work on variational inference via message passing, building scalable signal processing systems that know what they do not know, including speech denoising for hearing aids.

Before the PhD, I spent six years as a research scientist at imec and Philips working on wearable systems. Wearables taught me not to trust lab results too much. In controlled settings, models can look brilliant. In daily life, you move a sensor a few millimeters and the signal changes. Add motion, noise, and real human behavior, and the algorithm starts to fail. This line of work humbles you.

The failure is not mysterious. The system has no honest way to represent uncertainty. It produces a clean answer even when the situation is not clean.

Deep learning has achieved remarkable things, from large language models to generative video. But many models remain black boxes that rarely update safely or transparently. They excel at pattern matching, yet struggle to communicate their own limits. In real-world applications, including healthcare, you do not only want an answer. You want to know when that answer might be wrong. Actions have consequences.

That is why I work with Bayesian approaches and information theory. Bayesian inference is a principled way to reason under uncertainty: you start with prior beliefs, update them with data, and obtain a posterior distribution. Uncertainty is not a flaw to eliminate. It is information about the boundary between what you know and what you do not. This connects naturally to frameworks like the Free Energy Principle and Active Inference, which link perception, learning, and action into one loop. The goal is not just systems that predict. It is systems that adapt.

This does not mean Bayesian methods solve everything. Computing full posterior distributions in real time is expensive, and choosing priors is still more art than science. But at least you know what you are trading off. You start with a messy real-world question and translate it into a probabilistic model. That forces you to write your assumptions down explicitly. Then the mathematics tells you what follows from those assumptions, including how uncertain you should be.

The trick is not the math. The trick is being honest about what you assumed. Once it is written down, you can see exactly what you are trading off. And when a system fails, it is usually not “mysterious AI magic.” It is your assumptions, your model, or your computation meeting reality.

This website is my public notebook. I write to learn and to teach. I try to remove magic words and replace them with working intuition. Sometimes I write a post and realize halfway through that I was wrong about something fundamental. I leave those up. Being wrong in public is how you find out what you were confused about. If you encounter jargon here, it is because I have not understood it well enough yet to explain it simply.

My promise is simple. You will leave with clearer intuition, fewer fancy phrases, and better questions.
