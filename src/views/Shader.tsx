import { useEffect, useRef } from "react"
import AcidJPEG from "../assets/acid.jpeg"

const vertexShader = /*glsl*/`
  precision mediump float;
  attribute mediump vec2 a_position;
  uniform mediump vec2 u_resolution;
  uniform mediump float u_time;
  attribute vec2 a_texcoord;

  varying highp vec2 v_texcoord;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_texcoord = a_texcoord;
  }
`

const fragmentShader = /*glsl*/`
  precision mediump float;
  uniform mediump vec2 u_resolution;
  uniform mediump float u_time;
  uniform sampler2D u_sampler;
  varying highp vec2 v_texcoord;

  vec4 getPixel(vec2 position) {
    return texture2D(u_sampler, position);
  }

  float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;

    st.x += cos(st.x * 500.0) * sin(st.y * 100.0) * (0.001 * sin(u_time / 1.0));

    float onx = 1.0 / u_resolution.x;
    float ony = 1.0 / u_resolution.y;

    float offset = float(rand(st.xy + sin(u_time)) * rand((st.xy + u_time)) > 0.2);
    float offset2 = float(rand(st.yx + u_time) * rand((st.yx + cos(u_time))) > 0.5);

    vec4 color = getPixel(vec2(st.x + (onx * offset2), st.y + (ony * offset)));

    gl_FragColor = color;
  }
`

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)

  if (success) return shader

  console.error(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
}

const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
  const program = gl.createProgram()!

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  const success = gl.getProgramParameter(program, gl.LINK_STATUS)

  if (success) return program

  console.log(gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
}

const HEIGHT = 256

let renderer: number

const initWebgl = (gl: WebGL2RenderingContext) => {
  gl.canvas.width = Math.floor(window.innerWidth / window.innerHeight * HEIGHT)
  gl.canvas.height = HEIGHT
  
  const program = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, vertexShader)!,
    createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)!,
  )

  if (program == undefined) {
    console.error("Failed to create program")

    return
  }

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.useProgram(program)

  const positionAttributeLocation = gl.getAttribLocation(program, "a_position")
  const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution")
  const timeLocation = gl.getUniformLocation(program, "u_time"); 

  let time = 0

  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height)
  gl.uniform1f(timeLocation, time)

  {
    const positionBuffer = gl.createBuffer()

    const positions = [
      0, 0,
      gl.canvas.width, 0,
      0, gl.canvas.height,
      0, gl.canvas.height,
      gl.canvas.width, 0,
      gl.canvas.width, gl.canvas.height,
    ]

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(positionAttributeLocation)
  }

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

  const image = new Image(gl.canvas.width, gl.canvas.height)

  image.addEventListener("load", () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  })
  
  image.src = AcidJPEG

  {
    const size = 2
    const type = gl.FLOAT
    const normalize = false
    const stride = 0
    const offset = 0

    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset)
  }

  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  const source = new Uint8Array(gl.canvas.width * gl.canvas.height * 4)

  const render = () => {
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.flush()

    gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, source)
    
    gl.texImage2D(
      gl.TEXTURE_2D, 
      0, 
      gl.RGBA, 
      gl.canvas.width, 
      gl.canvas.height, 
      0, 
      gl.RGBA, 
      gl.UNSIGNED_BYTE,
      new Uint8Array(source),
    )

    return requestAnimationFrame(() => {
      gl.uniform1f(timeLocation, ++time)

      renderer = render()
    })
  }

  renderer = render()
}

export const Shader: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef) {
      initWebgl(canvasRef.current!.getContext("webgl2")!)
    }

    window.addEventListener("resize", () => {
      cancelAnimationFrame(renderer)

      initWebgl(canvasRef.current!.getContext("webgl2")!)
    })
  }, [canvasRef])
  
  return (
    <canvas ref={canvasRef}></canvas>
  )
}
