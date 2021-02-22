#version 300 es
precision highp float;

in vec2 v_texture_coord;

uniform sampler2D u_image;

out vec4 out_color;

void main() {
    out_color = texture(u_image, v_texture_coord);
}