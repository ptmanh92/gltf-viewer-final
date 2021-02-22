#version 300 es
precision highp float;

in vec4 a_position;
in vec3 a_color;
in vec2 a_texture_coord;

uniform mat4 u_transformation;

out vec3 fragColor;
out vec2 v_texture_coord;

void main() {
    fragColor = a_color;
    v_texture_coord = a_texture_coord;
    gl_Position = u_transformation * a_position;
}