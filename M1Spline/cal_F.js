<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title id="title">
      [utokyo-iscg-2023] Basic Assignment M1 - C2 interpolating splines
    </title>
    <script src="https://rawcdn.githack.com/toji/gl-matrix/v3.3.0/dist/gl-matrix-min.js"></script>
    <script src="https://bbcdn.githack.com/kenshi84/legacygl.js/raw/master/gl-matrix-util.js"></script>
    <script src="https://bbcdn.githack.com/kenshi84/legacygl.js/raw/master/legacygl.js"></script>
    <script src="https://bbcdn.githack.com/kenshi84/legacygl.js/raw/master/drawutil.js"></script>
    <script src="https://bbcdn.githack.com/kenshi84/legacygl.js/raw/master/camera.js"></script>
    <script src="https://bbcdn.githack.com/kenshi84/legacygl.js/raw/master/util.js"></script>
    <script src="https://bbcdn.githack.com/kenshi84/legacygl.js/raw/master/glu.js"></script>
    <script src="cal_F.js"></script>
    <script type="text/javascript">
      var gl;
      var canvas;
      var legacygl;
      var drawutil;
      var camera;
      var cal_p1;
      var cal_p2;
      var ti;
      var points;
      var degree;
      var mode = 0;
      var nearest = null;
      var selected = null;

      function eval_quadratic_bezier(l1, l2, r1, r2, d) {
        var ret = [...l1];
        for (var i = 0; i <= d; ++i) {
          ret[i] = [0, 0];
        }
        //console.log(r1, r2, d, ret);
        for (var i = 0; i <= d; ++i) {
          ret[i][0] = l1[i][0] * r1 + l2[i][0] * r2;
          ret[i][1] = l1[i][1] * r1 + l2[i][1] * r2;
        }
        if (d <= 0) return ret;
        return eval_quadratic_bezier(
          ret.slice(0, d),
          ret.slice(1, d + 1),
          r1,
          r2,
          d - 1
        );
      }

      function resetB() {
        init();
        document.inputs.reset();
        draw();
      }
      
      function move_point() {
        mode = 0;
      }

      function add_point() {
        mode = 1;
      }

      function remove_point() {
        mode = 2;
      }

      function draw() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // projection & camera position
        mat4.perspective(
          legacygl.uniforms.projection.value,
          Math.PI / 6,
          canvas.aspect_ratio(),
          0.1,
          1000
        );
        var modelview = legacygl.uniforms.modelview;
        camera.lookAt(modelview.value);

        // xy grid
        gl.lineWidth(1);
        legacygl.color(0.5, 0.5, 0.5);
        drawutil.xygrid(100);

        // draw line segments composing curve
        legacygl.color(1, 0.6, 0.2);

        var BezierPoints = [];

        var numsteps =
          Number(document.getElementById("input_numsteps").value) * 2;
        var k = 0;
        for (var j = 0; j <= degree; ++j) {
          var [j0, j1, j2, j3] = [
            Math.round(j % (degree + 1)),
            Math.round((j + 1) % (degree + 1)),
            Math.round((j + 2) % (degree + 1)),
            Math.round((j + 3) % (degree + 1)),
          ];
          [cal_p1, ti] = p_Bezier(points[j0], points[j1], points[j2]);
          [cal_p2, ti] = p_Bezier(points[j1], points[j2], points[j3]);
          for (var i = 0; i <= parseInt(ti * numsteps); ++i) {
            var t2 = i / numsteps;
            var t1 = t2 + ti;
            var sita = (t2 * Math.PI) / 2;
            var res1 = [...cal_p1];
            var res2 = [...cal_p2];
            res1 = eval_quadratic_bezier(
              res1.slice(0, 2),
              res1.slice(1, 3),
              1 - t1,
              t1,
              1
            );
            res2 = eval_quadratic_bezier(
              res2.slice(0, 2),
              res2.slice(1, 3),
              1 - t2,
              t2,
              1
            );
            BezierPoints[k] = sub(
              res1[0],
              res2[0],
              Math.cos(sita) ** 2,
              -(Math.sin(sita) ** 2)
            );
            k = k + 1;
          }
        }

        legacygl.begin(gl.LINE_STRIP);
        for (var i = 0; i <= k - 1; ++i) {
          legacygl.vertex2(BezierPoints[i]);
        }
        legacygl.end();

        // draw sample points

        if (document.getElementById("input_show_samplepoints").checked) {
          legacygl.begin(gl.POINTS);
          for (var i = 0; i <= k - 1; ++i) {
            legacygl.vertex2(BezierPoints[i]);
          }
          legacygl.end();
        }

        // draw control points
        if (document.getElementById("input_show_controlpoints").checked) {
          legacygl.color(0.2, 0.5, 1);

          legacygl.begin(gl.LINE_STRIP);
          for (var i = 0; i <= degree; ++i) {
            legacygl.vertex2(points[i]);
          }
          legacygl.end();

          legacygl.begin(gl.POINTS);
          for (var i = 0; i <= degree; ++i) {
            legacygl.vertex2(points[i]);
          }
          legacygl.end();
          
          legacygl.color(0.8, 0.3, 0.4);
          
          legacygl.begin(gl.LINE_STRIP);
          legacygl.vertex2(points[0]);
          legacygl.vertex2(points[degree]);
          legacygl.end();
        }
      }
      function init() {
        // OpenGL context
        canvas = document.getElementById("canvas");
        gl = canvas.getContext("experimental-webgl");
        if (!gl) alert("Could not initialise WebGL, sorry :-(");
        var vertex_shader_src =
          "\
        attribute vec3 a_vertex;\
        attribute vec3 a_color;\
        varying vec3 v_color;\
        uniform mat4 u_modelview;\
        uniform mat4 u_projection;\
        void main(void) {\
            gl_Position = u_projection * u_modelview * vec4(a_vertex, 1.0);\
            v_color = a_color;\
            gl_PointSize = 5.0;\
        }\
        ";
        var fragment_shader_src =
          "\
        precision mediump float;\
        varying vec3 v_color;\
        void main(void) {\
            gl_FragColor = vec4(v_color, 1.0);\
        }\
        ";
        legacygl = get_legacygl(gl, vertex_shader_src, fragment_shader_src);
        legacygl.add_uniform("modelview", "Matrix4f");
        legacygl.add_uniform("projection", "Matrix4f");
        legacygl.add_vertex_attribute("color", 3);
        legacygl.vertex2 = function (p) {
          this.vertex(p[0], p[1], 0);
        };
        drawutil = get_drawutil(gl, legacygl);
        camera = get_camera(canvas.width);
        camera.eye = [0, 0, 7];
        degree = 3;
        points = [
          [0.5, -0.8],
          [1.2, 0.5],
          [-0.4, 1.3],
          [-1, 0.1],
        ];
        nearest = null;
        selected = null;
        // event handlers
        canvas.onmousedown = function (evt) {
          var mouse_win = this.get_mousepos(evt);
          if (evt.altKey) {
            camera.start_moving(mouse_win, evt.shiftKey ? "zoom" : "pan");
            return;
          }
          // pick nearest object
          var viewport = [0, 0, canvas.width, canvas.height];
          var dist_min = 10000000;
          var nearest_index = 0;
          for (var i = 0; i <= degree; ++i) {
            var object_win = glu.project(
              [points[i][0], points[i][1], 0],
              legacygl.uniforms.modelview.value,
              legacygl.uniforms.projection.value,
              viewport
            );
            
            var dist = vec2.dist(mouse_win, object_win);
            if (dist < dist_min) {
              dist_min = dist;
              nearest = points[i];
              nearest_index = i;
            }
          }
          var zero = glu.project(
              [0, 0, 0],
              legacygl.uniforms.modelview.value,
              legacygl.uniforms.projection.value,
              viewport
            );
          var one = glu.project(
              [1, 1, 1],
              legacygl.uniforms.modelview.value,
              legacygl.uniforms.projection.value,
              viewport
            );
          
          var mouse_obj = [(mouse_win[0] - zero[0]) / (one[0] - zero[0]), (mouse_win[1] - zero[1]) / (one[1] - zero[1])];
          
          if (mode == 1) {
            degree += 1;
            points[degree] = mouse_obj;
          } else if (mode == 2) {
            if (degree > 3) {
              var tmp = points.slice(0, nearest_index);
              points = tmp.concat(points.slice(nearest_index + 1, degree + 1));
              degree -= 1;
            }
          } else if (mode == 0) {
            selected = nearest;
            nearest = null;
          }
          draw();
        };
        canvas.onmousemove = function (evt) {
          var mouse_win = this.get_mousepos(evt);
          if (camera.is_moving()) {
            camera.move(mouse_win);
            draw();
            return;
          }
          if (selected != null) {
            var viewport = [0, 0, canvas.width, canvas.height];
            mouse_win.push(1);
            var mouse_obj = glu.unproject(
              mouse_win,
              legacygl.uniforms.modelview.value,
              legacygl.uniforms.projection.value,
              viewport
            );
            // just reuse the same code as the 3D case
            var plane_origin = [0, 0, 0];
            var plane_normal = [0, 0, 1];
            var eye_to_mouse = vec3.sub([], mouse_obj, camera.eye);
            var eye_to_origin = vec3.sub([], plane_origin, camera.eye);
            var s1 = vec3.dot(eye_to_mouse, plane_normal);
            var s2 = vec3.dot(eye_to_origin, plane_normal);
            var eye_to_intersection = vec3.scale([], eye_to_mouse, s2 / s1);
            vec3.add(selected, camera.eye, eye_to_intersection);
            draw();
          }
        };
        document.onmouseup = function (evt) {
          if (camera.is_moving()) {
            camera.finish_moving();
            return;
          }
          selected = null;
        };
        // init OpenGL settings
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(1, 1, 1, 1);
      }
    </script>
  </head>
  <body onload="init(); draw();">
    <h2>
      <script type="text/javascript">
        document.write(document.getElementById("title").innerHTML);
      </script>
    </h2>
    <table>
      <tr>
        <td>
          <canvas
            id="canvas"
            width="640"
            height="480"
            style="border: 1px solid #000000"
          ></canvas>
        </td>
        <td style="display: flex;flex-direction: column;margin-left: 0px;">
          <b>
          <input
            type="button"
            id="move_point"
            onclick="move_point()"
            value="move"
          /></b><br>
          <input style="margin-top: -10px"
            type="button"
            id="add_point"
            onclick="add_point()"
            value="add"
          /><br>
          <input style="margin-top: -10px"
            type="button"
            id="rem_point"
            onclick="remove_point()"
            value="remove"
          />
        </td>
      </tr>
    </table>

    <table>
      <tr>
        <td colspan="2">
          <input type="button" id="reset" onclick="resetB()" value="reset"/>
        </td>
      </tr>
      <form name="inputs">
        <tr>
          <td>Number of Steps:</td>
          <td colspan="2">
            <input
              type="number"
              id="input_numsteps"
              onchange="draw();"
              step="1"
              min="2"
              value="20"
            />
          </td>
        </tr>
        <tr>
          <td>Show Control Points:</td>
          <td colspan="2">
            <input
              type="checkbox"
              id="input_show_controlpoints"
              onchange="draw();"
              checked
            />
          </td>
        </tr>
        <tr>
          <td>Show Sample Points:</td>
          <td colspan="2">
            <input
              type="checkbox"
              id="input_show_samplepoints"
              onchange="draw();"
              checked
            />
          </td>
        </tr>
      </form>
    </table>
    <h3>Usage:</h3>
    <ul>
      <li>Alt+Drag: Camera Pan</li>
      <li>Alt+Shift+drag: Camera Zoom</li>
    </ul>

    <div
      class="glitchButton"
      style="position: fixed; top: 20px; right: 20px"
    ></div>
    <script src="https://button.glitch.me/button.js"></script>
  </body>
</html>
