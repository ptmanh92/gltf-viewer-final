#version 300 es

#define POSITION 0
#define TEXCOORD_0 1

precision highp float;
precision highp int;

layout(location = POSITION) in vec4 a_position;
layout(location = TEXCOORD_0) in vec2 a_texture_coord;

uniform mat4 u_transformation;

out vec2 v_texture_coord;

void main() {
    v_texture_coord = a_texture_coord;
    gl_Position = u_transformation * a_position;
}