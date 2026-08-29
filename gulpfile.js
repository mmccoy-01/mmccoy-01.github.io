"use strict";

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import gulp from "gulp";
import concat from "gulp-concat";
import include from "gulp-include";
import plumber from "gulp-plumber";
import uglify from "gulp-uglify";
import { parse as parseYaml } from "yaml";

const paths = {
  config: "src/yml/_config.yml",
  theme: "src/yml/theme.yml",
  scripts: "src/js/main/**/*.js",
  previewScripts: "src/js/preview/**/*.*",
  images: "src/img/**/*.{jpg,png,gif,svg}",
};

function config() {
  return gulp
    .src(paths.config)
    .pipe(plumber())
    .pipe(include())
    .pipe(gulp.dest("./"));
}

function runJekyll(args, done) {
  const executable = process.platform === "win32" ? "bundle.bat" : "bundle";
  const child = spawn(executable, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  let settled = false;

  function settle(error) {
    if (settled) {
      return;
    }

    settled = true;
    done(error);
  }

  child.once("error", settle);
  child.once("close", (code) => {
    if (code === 0) {
      settle();
      return;
    }

    settle(new Error(`Jekyll exited with status ${code}.`));
  });
}

function jekyllBuild(done) {
  runJekyll(["exec", "jekyll", "build"], done);
}

function jekyllServe(done) {
  runJekyll(["exec", "jekyll", "serve", "--livereload"], done);
}

async function theme() {
  const source = await readFile(paths.theme, "utf8");
  const colors = parseYaml(source);

  if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
    throw new TypeError("src/yml/theme.yml must contain a color map.");
  }

  const entries = Object.entries(colors);
  if (entries.length === 0) {
    throw new TypeError("src/yml/theme.yml must define at least one color.");
  }

  for (const [name, value] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
      throw new TypeError(`Invalid Sass variable name: ${name}`);
    }

    if (typeof value !== "string" || !/^#[0-9A-Fa-f]{3,8}$/.test(value)) {
      throw new TypeError(`Invalid color value for ${name}: ${value}`);
    }
  }

  const lines = entries.map(([name, value]) => `  ${name}: ${value}`);
  await writeFile("_sass/_theme.scss", `$theme: (\n${lines.join(",\n")}\n);\n`, "utf8");
}

function mainJs() {
  return gulp
    .src(paths.scripts)
    .pipe(plumber())
    .pipe(uglify())
    .pipe(concat("scripts.min.js"))
    .pipe(gulp.dest("assets/js"));
}

function previewJs() {
  return gulp.src(paths.previewScripts).pipe(gulp.dest("assets/js"));
}

const scripts = gulp.parallel(mainJs, previewJs);

function images() {
  return gulp
    .src(paths.images, { encoding: false })
    .pipe(plumber())
    .pipe(gulp.dest("assets/img"));
}

function watchSources() {
  gulp.watch(["src/yml/*.yml", "!src/yml/theme.yml"], config);
  gulp.watch(paths.theme, theme);
  gulp.watch(paths.scripts, mainJs);
  gulp.watch(paths.previewScripts, previewJs);
  gulp.watch(paths.images, images);
}

const assets = gulp.parallel(scripts, images);
const build = gulp.series(gulp.parallel(assets, theme), config, jekyllBuild);
const run = gulp.series(
  gulp.parallel(assets, theme),
  config,
  gulp.parallel(jekyllServe, watchSources),
);

export { assets, build, config, images, run as default, scripts, theme };
